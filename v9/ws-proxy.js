#!/usr/bin/env node
import 'dotenv/config';
import WebSocket, { WebSocketServer } from 'ws';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

// ✅ NEXT LEVEL: Full conversational AI interviewer
const MODEL = 'gpt-realtime';
const PORT = 8081;

const wss = new WebSocketServer({ port: PORT });
console.log(`🎧 Next-Level AI Interview Server`);
console.log(`Model: ${MODEL} (Full Voice Conversation)`);
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
  let sampleRateHz = 24000; // ✅ CHANGED: 24kHz for better quality with gpt-realtime
  const targetMs = 100;
  let batchBytes = Math.ceil(sampleRateHz * 2 * (targetMs / 1000));
  let sessionReady = false;
  let currentQuestion = '';
  let interviewStarted = false;
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
    if (isAISpeaking) return; // ✅ Don't send audio while AI is speaking

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
    
    // ✅ NEXT LEVEL: AI INTERVIEWER CONFIGURATION
    ai.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800, // ✅ Wait longer for complete answers
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        modalities: ['text', 'audio'], // ✅ Both text and audio output
        voice: 'alloy', // ✅ Professional interviewer voice
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.8,
        max_response_output_tokens: 4096,
        
        // ✅ CRITICAL: AI INTERVIEWER INSTRUCTIONS
        instructions: `You are an expert professional interviewer conducting a realistic job interview. Your role:

1. ASK ONE QUESTION AT A TIME - Wait for complete answers
2. LISTEN CAREFULLY to the candidate's response
3. ASK NATURAL FOLLOW-UP QUESTIONS based on their answers:
   - "Can you tell me more about that?"
   - "What was the outcome?"
   - "How did you handle challenges?"
   - "What did you learn from that experience?"
4. PROVIDE ENCOURAGING FEEDBACK:
   - "That's a great example"
   - "I see, tell me more about..."
   - "Interesting, and then what happened?"
5. KEEP IT CONVERSATIONAL - Sound like a real human interviewer
6. BE EMPATHETIC - If candidate struggles, rephrase the question
7. MOVE TO NEXT QUESTION when answer is complete

IMPORTANT: You will receive the interview question from the system. Ask it naturally, then listen and engage with follow-ups.`,
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
        sessionReady = true;
        
        // Notify browser that AI is ready
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'ai_ready' }));
        }
      }
      
      else if (evt.type === 'session.created') {
        console.log('📋 Session created');
      }
      
      // ✅ CANDIDATE'S TRANSCRIPTION (what user said)
      else if (evt.type === 'conversation.item.input_audio_transcription.delta') {
        const text = evt.delta || '';
        if (text) {
          console.log('📝 User:', text);
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ 
              type: 'user_transcript', 
              delta: text 
            }));
          }
        }
      }
      
      else if (evt.type === 'conversation.item.input_audio_transcription.completed') {
        const text = evt.transcript || '';
        if (text) {
          console.log('✅ User Complete:', text);
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ 
              type: 'user_transcript_complete',
              text: text
            }));
          }
        }
      }
      
      // ✅ AI INTERVIEWER'S RESPONSE (text version)
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
          console.log('✅ AI Complete:', text);
          browser.send(JSON.stringify({ 
            type: 'ai_response_complete',
            text: text
          }));
        }
      }
      
      // ✅ AI AUDIO OUTPUT (for playback)
      else if (evt.type === 'response.audio.delta') {
        if (evt.delta && browser.readyState === WebSocket.OPEN) {
          isAISpeaking = true;
          // Send audio to browser for playback
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
      
      // ✅ RESPONSE LIFECYCLE
      else if (evt.type === 'response.done') {
        console.log('✅ Response complete');
        isAISpeaking = false;
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'ai_turn_complete' }));
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 User started speaking');
        hasUncommittedAudio = true;
        
        // ✅ INTERRUPT AI if user starts speaking
        if (isAISpeaking) {
          console.log('⏸️ Interrupting AI...');
          ai.send(JSON.stringify({ type: 'response.cancel' }));
          isAISpeaking = false;
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_stopped') {
        console.log('⏸️ User stopped speaking');
        if (hasUncommittedAudio) {
          ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
          
          // ✅ TRIGGER AI RESPONSE
          ai.send(JSON.stringify({ 
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
              instructions: 'Respond to the candidate naturally. Ask follow-up questions or provide feedback.'
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

  ai.on('close', (code, reason) => {
    console.log('🔴 OpenAI disconnected');
    resetBuffer();
    try { browser.close(); } catch {}
  });

  ai.on('error', (err) => {
    console.error('⚠️ OpenAI error:', err?.message || err);
  });

  // ✅ HANDLE BROWSER MESSAGES
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
        
        // ✅ NEW: Browser sends the interview question
        else if (evt?.type === 'start_question' && evt.question) {
          currentQuestion = evt.question;
          console.log(`📋 Starting question: ${currentQuestion}`);
          
          // ✅ AI asks the question
          ai.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: `Ask this interview question naturally and conversationally: "${currentQuestion}"`
                }
              ]
            }
          }));
          
          // Trigger AI response
          ai.send(JSON.stringify({ 
            type: 'response.create',
            response: {
              modalities: ['text', 'audio']
            }
          }));
          
          interviewStarted = true;
        }
        
        // ✅ NEW: Force next question
        else if (evt?.type === 'next_question') {
          console.log('⏭️ Moving to next question');
          if (browser.readyState === WebSocket.OPEN) {
            browser.send(JSON.stringify({ type: 'question_complete' }));
          }
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