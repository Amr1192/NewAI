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

// ⚙️ CONFIGURATION: Toggle AI follow-up questions
const ENABLE_AI_FOLLOWUP = true; // Set to true to enable AI follow-up questions

const wss = new WebSocketServer({ port: PORT });
console.log(`🎧 Real-Time Interview Server`);
console.log(`Model: ${MODEL}`);
console.log(`AI Follow-ups: ${ENABLE_AI_FOLLOWUP ? 'ENABLED ✅' : 'DISABLED ❌'}`);
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
  let hasUncommittedAudio = false;
  
  // Follow-up state
  let currentQuestion = '';
  let userAnswer = '';
  let hasAskedFollowup = false;

  const recalcBatch = () => {
    batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
    console.log(`📏 Batch: ${batchBytes} bytes (${targetMs}ms @ ${sampleRateHz}Hz)`);
  };

  function resetBuffer() {
    pcmChunks = [];
    pcmBytes = 0;
    hasUncommittedAudio = false;
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

  ai.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API');
    
    const modalities = ENABLE_AI_FOLLOWUP ? ['text', 'audio'] : ['text'];
    
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
        modalities: modalities,
        voice: 'alloy',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.8,
        max_response_output_tokens: ENABLE_AI_FOLLOWUP ? 50 : 1,
        instructions: ENABLE_AI_FOLLOWUP 
          ? 'You are a professional interviewer. When asked, generate ONE brief follow-up question.'
          : 'You are a transcription service. Transcribe exactly what the user says. Do not respond.',
      },
    }));
    
    console.log(`📤 Session configured (Follow-ups: ${ENABLE_AI_FOLLOWUP})`);
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
        console.log('✅ Session ready');
        sessionReady = true;
      }
      
      // Real-time transcription
      else if (evt.type === 'conversation.item.input_audio_transcription.delta') {
        const text = evt.delta || '';
        if (text) {
          console.log('📝', text);
          userAnswer += text;
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ 
              type: 'transcript',
              delta: text,
              is_partial: true
            }));
          }
        }
      }
      
      // Complete transcription
      else if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const text = evt.transcript || '';
        if (text) {
          console.log('✅ Complete:', text);
          userAnswer = text;
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ 
              type: 'transcript',
              delta: text,
              is_complete: true
            }));
            browser.send(JSON.stringify({ type: 'transcript_end' }));
          }
          
          // Generate follow-up if enabled and not asked yet
          if (ENABLE_AI_FOLLOWUP && !hasAskedFollowup && userAnswer.length > 30) {
            setTimeout(() => generateFollowup(), 1000);
          }
        }
      }
      
      // AI follow-up response
      else if (evt.type === 'response.audio.delta' && ENABLE_AI_FOLLOWUP) {
        if (evt.delta && browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({
            type: 'ai_audio',
            audio: evt.delta
          }));
        }
      }
      
      else if (evt.type === 'response.audio.done' && ENABLE_AI_FOLLOWUP) {
        console.log('🔊 AI follow-up spoken');
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'ai_audio_done' }));
        }
      }
      
      else if (evt.type === 'response.text.done' && ENABLE_AI_FOLLOWUP) {
        const text = evt.text || '';
        console.log('💬 AI follow-up:', text);
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ 
            type: 'ai_followup',
            text: text
          }));
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 Speech started');
        hasUncommittedAudio = true;
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'speech_started' }));
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_stopped') {
        console.log('⏸️ Speech stopped');
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'speech_stopped' }));
        }
        if (hasUncommittedAudio) {
          ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          hasUncommittedAudio = false;
        }
      }
      
    } catch (err) {
      console.error('Parse error:', err);
    }
  });

  function generateFollowup() {
    if (!ENABLE_AI_FOLLOWUP) return;
    
    console.log('🤔 Generating follow-up question...');
    hasAskedFollowup = true;
    
    if (browser.readyState === WebSocket.OPEN) {
      browser.send(JSON.stringify({ type: 'generating_followup' }));
    }
    
    ai.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: `Question: "${currentQuestion}"\nAnswer: "${userAnswer}"\n\nAsk ONE brief follow-up question (max 15 words).`
        }]
      }
    }));
    
    setTimeout(() => {
      ai.send(JSON.stringify({ 
        type: 'response.create',
        response: {
          modalities: ['text', 'audio'],
          max_output_tokens: 50
        }
      }));
    }, 100);
  }

  ai.on('close', () => {
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
        
        // Start new question
        else if (evt?.type === 'start_question' && evt.question) {
          console.log(`\n📋 NEW QUESTION: "${evt.question}"\n`);
          currentQuestion = evt.question;
          userAnswer = '';
          hasAskedFollowup = false;
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