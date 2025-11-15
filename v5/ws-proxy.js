#!/usr/bin/env node
import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

const MODEL = 'gpt-4o-realtime-preview-2024-12-17';
const PORT = 8081;

const wss = new WebSocketServer({ port: PORT });
console.log(`🎧 Proxy running on ws://127.0.0.1:${PORT} (model: ${MODEL})`);

wss.on('connection', (browser) => {
  console.log('🟢 Browser connected');

  const ai = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(MODEL)}`, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  let pcmChunks = [];
  let pcmBytes = 0;
  let sampleRateHz = 16000;
  
  // VERY small batch - send every 25ms for instant transcription!
  const targetMs = 25;
  let batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));

  const recalcBatch = () => {
    batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
    console.log(`📏 Batch size: ${batchBytes} bytes (${targetMs}ms @ ${sampleRateHz}Hz)`);
  };

  function resetBuffer() {
    pcmChunks = [];
    pcmBytes = 0;
  }

  function sendAppendIfReady() {
    if (ai.readyState !== WebSocket.OPEN) return;
    if (pcmBytes < batchBytes) return;

    const merged = Buffer.concat(pcmChunks, pcmBytes);
    resetBuffer();

    ai.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: merged.toString('base64'),
    }));
  }

  // Track if we need to commit the buffer
  let hasUncommittedAudio = false;

  // ---------- OpenAI side ----------
  ai.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API');
    
    // Configure session for INSTANT transcription
    ai.send(JSON.stringify({
      type: 'session.update',
      session: {
        // Use SERVER VAD for automatic speech detection
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500  // Shorter silence = faster response
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        // Enable BOTH text modalities to get transcription
        modalities: ['text', 'audio'],
        // Critical: Enable input audio transcription
        input_audio_transcription: {
          model: 'whisper-1'
        },
        // Instructions to make it transcribe everything
        instructions: `You are a transcription assistant. Your job is to transcribe everything the user says accurately and immediately. 
        
Transcribe word-by-word as the user speaks. Do not wait for complete sentences.
Do not add any commentary, questions, or responses.
Just transcribe exactly what you hear.`,
        temperature: 0.3,
      },
    }));
    
    console.log('✅ Session configured for instant transcription');
  });

  ai.on('message', (data, isBinary) => {
    if (isBinary) {
      return;
    }
    
    try {
      const evt = JSON.parse(String(data));
      
      // Log important events
      if (evt.type === 'error') {
        console.error('⚠️ Error:', evt.error);
        browser.send(JSON.stringify({ type: 'error', message: evt.error.message }));
      }
      
      // INSTANT transcription as audio comes in
      else if (evt.type === 'conversation.item.input_audio_transcription.delta') {
        // This fires DURING speech - perfect for real-time!
        const text = evt.delta || '';
        if (text) {
          console.log('📝 LIVE:', text);
          browser.send(JSON.stringify({ type: 'transcript', delta: text }));
        }
      }
      
      // Complete transcription when speech ends
      else if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const text = evt.transcript || '';
        console.log('✅ Complete:', text);
        browser.send(JSON.stringify({ type: 'transcript', delta: text }));
        browser.send(JSON.stringify({ type: 'transcript_end' }));
      }
      
      // Speech detection events
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 Speech started');
        hasUncommittedAudio = true;
      }
      
      else if (evt.type === 'input_audio_buffer.speech_stopped') {
        console.log('⏸️  Speech stopped');
        // Commit the audio buffer
        if (hasUncommittedAudio) {
          ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          hasUncommittedAudio = false;
        }
      }
      
      // Response events (we'll get text from the AI)
      else if (evt.type === 'response.audio_transcript.delta') {
        // This is AI speaking - ignore for transcription
        return;
      }
      
      else if (evt.type === 'response.text.delta') {
        // This is AI text response - ignore
        return;
      }
      
      // Session events
      else if (evt.type === 'session.created' || evt.type === 'session.updated') {
        console.log('✅', evt.type);
      }
      
      // Log other events for debugging
      else if (!evt.type.includes('.delta') && !evt.type.includes('audio.')) {
        console.log('📥', evt.type);
      }
      
    } catch (err) {
      console.error('❌ Parse error:', err);
    }
  });

  ai.on('close', (code, reason) => {
    console.log('🔴 OpenAI connection closed', code, reason?.toString?.());
    resetBuffer();
    try { browser.close(); } catch {}
  });

  ai.on('error', (err) => console.error('⚠️ OpenAI error:', err?.message || err));

  // ---------- Browser side ----------
  browser.on('message', (msg) => {
    if (Buffer.isBuffer(msg)) {
      pcmChunks.push(msg);
      pcmBytes += msg.length;
      hasUncommittedAudio = true;
      if (pcmBytes >= batchBytes) sendAppendIfReady();
    } else {
      try {
        const evt = JSON.parse(String(msg));
        if (evt?.type === 'config' && typeof evt.sampleRate === 'number') {
          sampleRateHz = evt.sampleRate | 0;
          recalcBatch();
        }
      } catch {}
    }
  });

  browser.on('close', () => {
    console.log('🔴 Browser disconnected');
    resetBuffer();
    try { ai.close(); } catch {}
  });

  browser.on('error', () => {
    resetBuffer();
    try { ai.close(); } catch {}
  });
});