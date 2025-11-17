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
const MAX_FOLLOWUPS = 1; // ✅ Only allow 1 follow-up question

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
  let hasUncommittedAudio = false;
  
  // ✅ NEW: Track follow-ups and conversation state
  let followupCount = 0;
  let hasAskedMainQuestion = false;
  let waitingForUserAnswer = false;
  let conversationTurns = 0;

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

  ai.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API');
    
    // ✅ IMPROVED: Strict instructions to prevent endless follow-ups
    ai.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        modalities: ['text', 'audio'],
        voice: 'alloy',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.7,
        max_response_output_tokens: 300, // ✅ Keep responses short
        instructions: `You are a professional interviewer conducting a job interview.

STRICT RULES:
1. When given a question, ask it EXACTLY as provided - do NOT add anything
2. After asking the main question, WAIT for the candidate's full answer
3. You may ask ONLY ONE brief follow-up question for clarification
4. After the follow-up answer, say ONLY: "Thank you, that's helpful."
5. Do NOT ask multiple follow-ups - ONE is the maximum
6. Keep ALL responses under 2 sentences
7. Do NOT elaborate, explain, or add commentary

Example flow:
- You: "Tell me about a challenging project you worked on."
- Candidate: [answers]
- You: "What was the biggest obstacle you faced?" (ONE follow-up)
- Candidate: [answers]
- You: "Thank you, that's helpful." (DONE - stop talking)

Never ask more than 1 follow-up per question.`,
      },
    }));
    
    console.log('📤 Session configured with follow-up limits');
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
      
      // Real-time user transcription
      else if (evt.type === 'conversation.item.input_audio_transcription.delta') {
        const text = evt.delta || '';
        if (text && browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ 
            type: 'user_transcript_delta',
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
          browser.send(JSON.stringify({ 
            type: 'ai_response_delta',
            delta: text 
          }));
        }
      }
      
      else if (evt.type === 'response.text.done') {
        const text = evt.text || '';
        if (text && browser.readyState === WebSocket.OPEN) {
          console.log('✅ AI said:', text);
          
          // ✅ CHECK: Did AI ask a question?
          if (text.includes('?')) {
            followupCount++;
            console.log(`❓ Follow-up ${followupCount}/${MAX_FOLLOWUPS} detected`);
          }
          
          browser.send(JSON.stringify({ 
            type: 'ai_response_complete',
            text: text,
            followup_count: followupCount
          }));
        }
      }
      
      // AI audio
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
        conversationTurns++;
        
        // ✅ AUTO-ADVANCE: If we've had 1 follow-up, signal to move to next question
        if (followupCount >= MAX_FOLLOWUPS && conversationTurns >= 3) {
          console.log('🎯 Max follow-ups reached - auto-advancing to next question');
          
          setTimeout(() => {
            if (browser.readyState === WebSocket.OPEN) {
              browser.send(JSON.stringify({ 
                type: 'auto_advance',
                reason: 'max_followups_reached'
              }));
            }
          }, 2000); // Wait 2 seconds after AI finishes
        }
        
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'ai_turn_complete' }));
        }
      }
      
      // User speech detection
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 User speaking');
        hasUncommittedAudio = true;
        waitingForUserAnswer = false;
        
        // Cancel AI if speaking
        if (isAISpeaking) {
          console.log('⏸️ User interrupted - canceling AI');
          ai.send(JSON.stringify({ type: 'response.cancel' }));
          isAISpeaking = false;
        }
        
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'user_speaking_started' }));
        }
      }
      
      else if (evt.type === 'input_audio_buffer.speech_stopped') {
        console.log('⏸️ User stopped speaking');
        
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'user_speaking_stopped' }));
        }
        
        if (hasUncommittedAudio) {
          setTimeout(() => {
            ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
            
            // ✅ SMART RESPONSE: Only generate follow-up if we haven't reached limit
            if (followupCount < MAX_FOLLOWUPS && hasAskedMainQuestion) {
              console.log('💬 Requesting follow-up (if needed)');
              ai.send(JSON.stringify({ 
                type: 'response.create',
                response: {
                  modalities: ['text', 'audio'],
                  max_output_tokens: 200
                }
              }));
            } else if (followupCount >= MAX_FOLLOWUPS) {
              console.log('⏭️ Max follow-ups reached - waiting for user to continue');
              // Just acknowledge, don't ask more questions
              ai.send(JSON.stringify({
                type: 'conversation.item.create',
                item: {
                  type: 'message',
                  role: 'assistant',
                  content: [{
                    type: 'text',
                    text: 'Thank you for your answer.'
                  }]
                }
              }));
            }
            
            hasUncommittedAudio = false;
          }, 200);
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
      // Audio data
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
        
        // ✅ START NEW QUESTION - Reset counters
        else if (evt?.type === 'start_question' && evt.question) {
          console.log(`\n📋 NEW QUESTION: "${evt.question}"\n`);
          
          // Reset conversation state
          followupCount = 0;
          hasAskedMainQuestion = false;
          waitingForUserAnswer = true;
          conversationTurns = 0;
          
          // Clear conversation
          ai.send(JSON.stringify({ type: 'conversation.clear' }));
          ai.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          
          // Add strict system message
          ai.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'system',
              content: [{
                type: 'text',
                text: `Ask this question EXACTLY: "${evt.question}"

Then WAIT for the answer. You may ask ONE brief follow-up for clarification. After that, say "Thank you" and STOP.`
              }]
            }
          }));
          
          // Trigger AI to ask
          ai.send(JSON.stringify({ 
            type: 'response.create',
            response: {
              modalities: ['text', 'audio'],
              max_output_tokens: 150
            }
          }));
          
          hasAskedMainQuestion = true;
        }
        
        else if (evt?.type === 'stop_ai') {
          console.log('🛑 Force stop AI');
          if (isAISpeaking) {
            ai.send(JSON.stringify({ type: 'response.cancel' }));
            isAISpeaking = false;
          }
        }
        
        // ✅ MANUAL NEXT QUESTION
        else if (evt?.type === 'next_question') {
          console.log('⏭️ User manually requested next question');
          followupCount = 0;
          hasAskedMainQuestion = false;
          conversationTurns = 0;
          
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