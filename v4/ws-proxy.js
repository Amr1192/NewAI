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
  const targetMs = 200;
  let batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));

  const recalcBatch = () => {
    batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
    console.log(`📏 Append batch ≈${targetMs}ms → ${batchBytes} bytes @ ${sampleRateHz}Hz`);
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

    const ms = ((merged.length / (2 * sampleRateHz)) * 1000).toFixed(1);
    console.log(`🎙️ APPEND ${merged.length} bytes (~${ms} ms)`);

    ai.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: merged.toString('base64'),
    }));
  }

  // ---------- OpenAI side ----------
  ai.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API');
    console.log('📤 Sending session.update...');
    
    ai.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: { type: 'server_vad' },
        input_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        modalities: ['text'],
      },
    }));
    
    console.log('✅ Session update sent');
  });

  ai.on('message', (data, isBinary) => {
    if (isBinary) {
      console.log('📥 Received binary data (length:', data.length, ')');
      return;
    }
    
    try {
      const evt = JSON.parse(String(data));
      console.log('📥 OpenAI event:', JSON.stringify(evt, null, 2));
      
      if (evt.type === 'error') {
        console.error('⚠️ Realtime API error event:', evt);
      } 
      // Try ALL possible transcript event types
      else if (evt.type === 'response.output_text.delta' && evt.delta) {
        console.log('✅ Got text delta:', evt.delta);
        browser.send(JSON.stringify({ type: 'transcript', delta: evt.delta }));
      } 
      else if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        console.log('✅ Got transcription:', evt.transcript);
        browser.send(JSON.stringify({ type: 'transcript', delta: evt.transcript }));
        browser.send(JSON.stringify({ type: 'transcript_end' }));
      }
      else if (evt.type === 'response.text.delta' && evt.delta) {
        console.log('✅ Got response text delta:', evt.delta);
        browser.send(JSON.stringify({ type: 'transcript', delta: evt.delta }));
      }
      else if (evt.type === 'response.completed') {
        console.log('✅ Response completed');
        browser.send(JSON.stringify({ type: 'transcript_end' }));
      }
      else if (evt.transcript) {
        console.log('✅ Found transcript field:', evt.transcript);
        browser.send(JSON.stringify({ type: 'transcript', delta: evt.transcript }));
      }
    } catch (err) {
      console.error('❌ Parse error:', err, 'Raw:', String(data).substring(0, 200));
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