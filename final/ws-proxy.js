#!/usr/bin/env node
import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

const MODEL = 'gpt-realtime';
const PORT = 8081;

const wss = new WebSocketServer({ port: PORT });
console.log(`🎧 AI Interview Server (DEBUG MODE)`);
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
  let sampleRateHz = 24000;
  const targetMs = 100;
  let batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
  let sessionReady = false;
  let hasUncommittedAudio = false;
  let audioChunksReceived = 0;

  const recalcBatch = () => {
    batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
    console.log(`📏 Batch size: ${batchBytes} bytes (${targetMs}ms @ ${sampleRateHz}Hz)`);
  };

  function resetBuffer() {
    pcmChunks = [];
    pcmBytes = 0;
    hasUncommittedAudio = false;
  }

  function sendAppendIfReady() {
    if (ai.readyState !== WebSocket.OPEN) {
      console.log('⚠️ Cannot send - AI not connected');
      return;
    }
    if (!sessionReady) {
      console.log('⚠️ Cannot send - session not ready');
      return;
    }
    if (pcmBytes < batchBytes) {
      console.log(`⚠️ Buffer too small: ${pcmBytes}/${batchBytes} bytes`);
      return;
    }

    const merged = Buffer.concat(pcmChunks, pcmBytes);
    resetBuffer();

    console.log(`📤 Sending ${merged.length} bytes to OpenAI`);
    ai.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: merged.toString('base64'),
    }));
  }

  ai.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API');
    
    ai.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        modalities: ['text'],
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.8,
        max_response_output_tokens: 1,
        instructions: 'You are a transcription service. Only transcribe what the user says. Do not respond.',
      },
    }));
    
    console.log('📤 Session config sent');
  });

  ai.on('message', (data, isBinary) => {
    if (isBinary) return;
    
    try {
      const evt = JSON.parse(String(data));
      console.log(`📨 OpenAI event: ${evt.type}`);
      
      if (evt.type === 'error') {
        console.error('❌ OpenAI Error:', evt.error);
        browser.send(JSON.stringify({ 
          type: 'error', 
          message: evt.error.message 
        }));
      }
      
      else if (evt.type === 'session.updated') {
        console.log('✅ Session ready for transcription');
        console.log('📋 Session config:', JSON.stringify(evt.session, null, 2));
        sessionReady = true;
      }
      
      else if (evt.type === 'session.created') {
        console.log('📋 Session created');
      }
      
      // Real-time transcription delta
      else if (evt.type === 'conversation.item.input_audio_transcription.delta') {
        const text = evt.delta || '';
        if (text) {
          console.log('📝 TRANSCRIPT DELTA:', text);
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ 
              type: 'transcript',
              delta: text 
            }));
          }
        }
      }
      
      // Complete transcription
      else if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const text = evt.transcript || '';
        if (text) {
          console.log('✅ COMPLETE TRANSCRIPT:', text);
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ 
              type: 'transcript',
              delta: text
            }));
            browser.send(JSON.stringify({ 
              type: 'transcript_end'
            }));
          }
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 SPEECH DETECTED - User started speaking!');
        hasUncommittedAudio = true;
      }
      
      else if (evt.type === 'input_audio_buffer.speech_stopped') {
        console.log('⏸️ SPEECH STOPPED - User stopped speaking');
        
        if (hasUncommittedAudio) {
          setTimeout(() => {
            console.log('📤 Committing audio buffer...');
            ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
            hasUncommittedAudio = false;
          }, 300);
        }
      }
      
      else if (evt.type === 'input_audio_buffer.committed') {
        console.log('✅ Audio buffer committed - waiting for transcription');
        hasUncommittedAudio = false;
      }
      
    } catch (err) {
      console.error('❌ Parse error:', err);
    }
  });

  ai.on('close', () => {
    console.log('🔴 OpenAI disconnected');
    resetBuffer();
    try { browser.close(); } catch {}
  });

  ai.on('error', (err) => {
    console.error('⚠️ OpenAI WebSocket error:', err?.message || err);
  });

  // Handle browser messages
  browser.on('message', (msg) => {
    if (Buffer.isBuffer(msg)) {
      audioChunksReceived++;
      
      // Log every 50 chunks
      if (audioChunksReceived % 50 === 0) {
        console.log(`🎵 Received ${audioChunksReceived} audio chunks (${msg.length} bytes each)`);
      }
      
      pcmChunks.push(msg);
      pcmBytes += msg.length;
      hasUncommittedAudio = true;
      
      if (pcmBytes >= batchBytes) {
        sendAppendIfReady();
      }
    } else {
      try {
        const evt = JSON.parse(String(msg));
        console.log(`📨 Browser event: ${evt.type}`, evt);
        
        if (evt?.type === 'config' && typeof evt.sampleRate === 'number') {
          sampleRateHz = evt.sampleRate | 0;
          console.log(`🔧 Sample rate configured: ${sampleRateHz}Hz`);
          recalcBatch();
        }
      } catch (err) {
        console.error('❌ Message parse error:', err);
      }
    }
  });

  browser.on('close', () => {
    console.log('🔴 Browser disconnected\n');
    console.log(`📊 Stats: Received ${audioChunksReceived} audio chunks total`);
    resetBuffer();
    try { ai.close(); } catch {}
  });

  browser.on('error', (err) => {
    console.error('⚠️ Browser WebSocket error:', err);
    resetBuffer();
    try { ai.close(); } catch {}
  });
});