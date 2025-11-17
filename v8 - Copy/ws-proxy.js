#!/usr/bin/env node
import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

// ✅ FIXED: Use your actual model
const MODEL = 'gpt-realtime';
const PORT = 8081;

const wss = new WebSocketServer({ port: PORT });
console.log(`🎧 Realtime Transcription Server`);
console.log(`Model: ${MODEL}`);
console.log(`Port: ws://127.0.0.1:${PORT}\n`);

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
  const targetMs = 100;
  let batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
  let sessionReady = false;

  const recalcBatch = () => {
    batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
    console.log(`📏 Batch: ${batchBytes} bytes (${targetMs}ms @ ${sampleRateHz}Hz)`);
  };

  function resetBuffer() {
    pcmChunks = [];
    pcmBytes = 0;
  }

  function sendAppendIfReady() {
    if (ai.readyState !== WebSocket.OPEN) return;
    if (!sessionReady) return;
    if (pcmBytes < batchBytes) return;

    const merged = Buffer.concat(pcmChunks, pcmBytes);
    resetBuffer();

    ai.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: merged.toString('base64'),
    }));
  }

  let hasUncommittedAudio = false;

  ai.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API');
    
    // ✅ FIXED: Temperature range for gpt-realtime
    ai.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        modalities: ['text', 'audio'],
        input_audio_transcription: {
          model: 'whisper-1'
        },
        // ✅ Try 0.7 (if 0.6 fails, adjust based on model requirements)
        temperature: 0.7,
        instructions: 'You are a transcription service. Transcribe exactly what the user says. Do not respond or add commentary.',
        max_response_output_tokens: 1,
      },
    }));
    
    console.log('📤 Session config sent');
  });

  ai.on('message', (data, isBinary) => {
    if (isBinary) return;
    
    try {
      const evt = JSON.parse(String(data));
      
      if (evt.type === 'error') {
        console.error('❌ Error:', evt.error.message);
        browser.send(JSON.stringify({ type: 'error', message: evt.error.message }));
      }
      
      else if (evt.type === 'session.updated') {
        console.log('✅ Session configured');
        if (evt.session.input_audio_transcription) {
          console.log('✅ Transcription enabled:', evt.session.input_audio_transcription.model);
          sessionReady = true;
        } else {
          console.error('❌ Transcription NOT enabled!');
        }
      }
      
      // Real-time word-by-word transcription
      else if (evt.type === 'conversation.item.input_audio_transcription.delta') {
        const text = evt.delta || '';
        if (text) {
          console.log('📝', text);
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ type: 'transcript', delta: text }));
          }
        }
      }
      
      // Complete transcription
      else if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const text = evt.transcript || '';
        if (text) {
          console.log('✅ Complete:', text);
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ type: 'transcript', delta: text }));
            browser.send(JSON.stringify({ type: 'transcript_end' }));
          }
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 Speech started');
        hasUncommittedAudio = true;
      }
      
      else if (evt.type === 'input_audio_buffer.speech_stopped') {
        console.log('⏸️ Speech stopped');
        if (hasUncommittedAudio) {
          ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          hasUncommittedAudio = false;
        }
      }
      
      else if (evt.type === 'session.created') {
        console.log('📋 Session created');
      }
      
      // Ignore AI response events (we only want transcription)
      else if (evt.type.startsWith('response.')) {
        return;
      }
      
    } catch (err) {
      console.error('Parse error:', err);
    }
  });

  ai.on('close', (code, reason) => {
    console.log('🔴 OpenAI disconnected');
    resetBuffer();
    try { browser.close(); } catch {}
  });

  ai.on('error', (err) => {
    console.error('⚠️ OpenAI error:', err?.message || err);
  });

  browser.on('message', (msg) => {
    if (Buffer.isBuffer(msg)) {
      pcmChunks.push(msg);
      pcmBytes += msg.length;
      hasUncommittedAudio = true;
      
      if (pcmBytes >= batchBytes) {
        sendAppendIfReady();
      }
    } else {
      try {
        const evt = JSON.parse(String(msg));
        if (evt?.type === 'config' && typeof evt.sampleRate === 'number') {
          sampleRateHz = evt.sampleRate | 0;
          console.log(`🔧 Sample rate: ${sampleRateHz}Hz`);
          recalcBatch();
        }
      } catch {}
    }
  });

  browser.on('close', () => {
    console.log('🔴 Browser disconnected\n');
    resetBuffer();
    try { ai.close(); } catch {}
  });

  browser.on('error', () => {
    resetBuffer();
    try { ai.close(); } catch {}
  });
});