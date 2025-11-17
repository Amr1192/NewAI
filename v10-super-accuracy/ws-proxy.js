#!/usr/bin/env node
import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

const MODEL = 'gpt-4o-realtime-preview-2024-10-01';
const PORT = 8081;

const wss = new WebSocketServer({ port: PORT });
console.log(`🎧 AI Interview Server Running`);
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
  let isAISpeaking = false;

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
    if (isAISpeaking) return;

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
    
    // Basic session configuration
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
        modalities: ['text', 'audio'],
        voice: 'alloy',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.8,
        max_response_output_tokens: 4096,
        instructions: `You are a professional interviewer conducting a job interview. 

When you receive an interview question to ask:
- Ask it clearly and naturally
- Wait for the candidate's complete answer
- Provide brief follow-up questions when appropriate
- Give encouraging feedback

Be conversational and professional.`,
      },
    }));
    
    console.log('📤 Session configured');
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
        browser.send(JSON.stringify({ type: 'ai_ready' }));
      }
      
      else if (evt.type === 'session.created') {
        console.log('📋 Session created');
      }
      
      // User transcription
      else if (evt.type === 'conversation.item.input_audio_transcription.delta') {
        const text = evt.delta || '';
        if (text && browser.readyState === WebSocket.OPEN) {
          console.log('📝 User:', text);
          browser.send(JSON.stringify({ 
            type: 'user_transcript', 
            delta: text 
          }));
        }
      }
      
      else if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const text = evt.transcript || '';
        if (text && browser.readyState === WebSocket.OPEN) {
          console.log('✅ User said:', text);
          browser.send(JSON.stringify({ 
            type: 'user_transcript_complete',
            text: text
          }));
        }
      }
      
      // AI text response
      else if (evt.type === 'response.text.delta') {
        const text = evt.delta || '';
        if (text && browser.readyState === WebSocket.OPEN) {
          console.log('🤖 AI:', text);
          browser.send(JSON.stringify({ 
            type: 'ai_response', 
            delta: text 
          }));
        }
      }
      
      else if (evt.type === 'response.text.done') {
        const text = evt.text || '';
        if (text && browser.readyState === WebSocket.OPEN) {
          console.log('✅ AI complete');
          browser.send(JSON.stringify({ 
            type: 'ai_response_complete',
            text: text
          }));
        }
      }
      
      // AI audio output
      else if (evt.type === 'response.audio.delta') {
        if (evt.delta && browser.readyState === WebSocket.OPEN) {
          isAISpeaking = true;
          browser.send(JSON.stringify({
            type: 'ai_audio',
            audio: evt.delta
          }));
        }
      }
      
      else if (evt.type === 'response.audio.done') {
        console.log('🔊 AI finished speaking');
        isAISpeaking = false;
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'ai_audio_done' }));
        }
      }
      
      else if (evt.type === 'response.done') {
        console.log('✅ Response complete');
        isAISpeaking = false;
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'ai_turn_complete' }));
        }
      }
      
      // User speech detection
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 User speaking');
        hasUncommittedAudio = true;
        
        // Cancel AI if it's speaking
        if (isAISpeaking) {
          console.log('⏸️ Interrupting AI');
          ai.send(JSON.stringify({ type: 'response.cancel' }));
          isAISpeaking = false;
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_stopped') {
        console.log('⏸️ User stopped');
        if (hasUncommittedAudio) {
          ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          
          // Request AI response
          ai.send(JSON.stringify({ 
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }));
          
          hasUncommittedAudio = false;
        }
      }
      
      else if (evt.type === 'input_audio_buffer.committed') {
        console.log('✅ Audio committed');
      }
      
    } catch (err) {
      console.error('Parse error:', err);
    }
  });

  ai.on('close', () => {
    console.log('🔴 OpenAI disconnected');
    resetBuffer();
    try { browser.close(); } catch {}
  });

  ai.on('error', (err) => {
    console.error('⚠️ OpenAI error:', err?.message || err);
  });

  // Handle browser messages
  browser.on('message', (msg) => {
    if (Buffer.isBuffer(msg)) {
      // Audio data from browser
      pcmChunks.push(msg);
      pcmBytes += msg.length;
      hasUncommittedAudio = true;
      
      if (pcmBytes >= batchBytes) {
        sendAppendIfReady();
      }
    } else {
      try {
        const evt = JSON.parse(String(msg));
        
        // Sample rate config
        if (evt?.type === 'config' && typeof evt.sampleRate === 'number') {
          sampleRateHz = evt.sampleRate | 0;
          console.log(`🔧 Sample rate: ${sampleRateHz}Hz`);
          recalcBatch();
        }
        
        // Start question - SIMPLIFIED
        else if (evt?.type === 'start_question' && evt.question) {
          console.log(`\n📋 NEW QUESTION: "${evt.question}"\n`);
          
          // Clear any pending audio
          ai.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          
          // Add question as a user message (asking AI to say it)
          ai.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{
                type: 'input_text',
                text: `Please ask me this interview question: "${evt.question}"`
              }]
            }
          }));
          
          // Commit and generate response
          ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          ai.send(JSON.stringify({ 
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }));
        }
        
        else if (evt?.type === 'next_question') {
          console.log('⏭️ Next question requested');
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ type: 'question_complete' }));
          }
        }
        
      } catch (err) {
        console.error('Message parse error:', err);
      }
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