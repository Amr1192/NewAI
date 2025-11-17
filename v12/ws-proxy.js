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
const MAX_FOLLOWUPS = 1; // Strict limit

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
  
  // Conversation tracking
  let followupCount = 0;
  let hasAskedMainQuestion = false;
  let userHasAnswered = false;
  let questionAsked = false;

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
    if (isAISpeaking) return;

    const merged = Buffer.concat(pcmChunks, pcmBytes);
    resetBuffer();

    ai.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: merged.toString('base64'),
    }));
  }

  // Safe commit with buffer check
  function safeCommit() {
    if (!hasUncommittedAudio) {
      console.log('⚠️ No audio to commit, skipping');
      return;
    }
    
    // Only commit if we have enough audio data
    if (pcmBytes < batchBytes / 2) {
      console.log('⚠️ Buffer too small, clearing instead of committing');
      resetBuffer();
      return;
    }
    
    try {
      ai.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      hasUncommittedAudio = false;
      console.log('✅ Audio committed');
    } catch (err) {
      console.error('❌ Commit error:', err);
      resetBuffer();
    }
  }

  ai.on('open', () => {
    console.log('🤖 Connected to OpenAI Realtime API');
    
    ai.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.6,
          prefix_padding_ms: 300,
          silence_duration_ms: 700, // Increased to avoid premature detection
        },
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        modalities: ['text', 'audio'],
        voice: 'alloy',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        temperature: 0.6,
        max_response_output_tokens: 250,
        instructions: `You are a professional interviewer. Follow these STRICT rules:

1. When given a question to ask, say it EXACTLY as written - word for word
2. After asking, WAIT for the candidate's complete answer
3. You may ask ONLY ONE brief follow-up question (5-10 words max)
4. After the follow-up answer, say ONLY: "Thank you."
5. NEVER ask a second follow-up - ONE is the absolute maximum
6. Keep all responses under 15 words

Flow example:
- You: [Ask the exact question provided]
- Candidate: [Answers]
- You: "Can you elaborate on that?" (ONE follow-up only)
- Candidate: [Answers]
- You: "Thank you." (STOP HERE)

CRITICAL: Never exceed 1 follow-up question per interview question.`,
      },
    }));
    
    console.log('📤 Session configured');
  });

  ai.on('message', (data, isBinary) => {
    if (isBinary) return;
    
    try {
      const evt = JSON.parse(String(data));
      
      if (evt.type === 'error') {
        console.error('❌ OpenAI Error:', evt.error.message);
        
        // Handle buffer errors gracefully
        if (evt.error.message.includes('buffer too small')) {
          console.log('⚠️ Clearing small buffer');
          resetBuffer();
          ai.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          return;
        }
        
        browser.send(JSON.stringify({ 
          type: 'error', 
          message: evt.error.message 
        }));
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
          console.log('✅ User transcript:', text);
          userHasAnswered = true;
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
          
          // Track if this was a question (follow-up)
          const isQuestion = text.includes('?');
          
          if (isQuestion && hasAskedMainQuestion && userHasAnswered) {
            followupCount++;
            console.log(`❓ Follow-up #${followupCount} detected`);
            
            // If we've hit the limit, inject a closing statement
            if (followupCount >= MAX_FOLLOWUPS) {
              console.log('🛑 MAX FOLLOW-UPS REACHED - Forcing closure');
              setTimeout(() => {
                ai.send(JSON.stringify({
                  type: 'conversation.item.create',
                  item: {
                    type: 'message',
                    role: 'assistant',
                    content: [{
                      type: 'text',
                      text: 'Thank you for your detailed answers.'
                    }]
                  }
                }));
                
                // Signal auto-advance
                if (browser.readyState === WebSocket.OPEN) {
                  browser.send(JSON.stringify({ 
                    type: 'auto_advance',
                    reason: 'max_followups'
                  }));
                }
              }, 1500);
            }
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
        
        if (browser.readyState === WebSocket.OPEN) {
          browser.send(JSON.stringify({ type: 'ai_turn_complete' }));
        }
      }
      
      // User speech detection
      else if (evt.type === 'input_audio_buffer.speech_started') {
        console.log('🎤 User speaking');
        hasUncommittedAudio = true;
        
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
        
        // Wait a bit before committing to ensure we have enough audio
        setTimeout(() => {
          safeCommit();
          
          // Only generate response if we haven't exceeded follow-up limit
          if (followupCount < MAX_FOLLOWUPS && questionAsked) {
            console.log('💬 Requesting AI response');
            ai.send(JSON.stringify({ 
              type: 'response.create',
              response: {
                modalities: ['text', 'audio'],
                max_output_tokens: 150
              }
            }));
          } else if (followupCount >= MAX_FOLLOWUPS) {
            console.log('⏭️ Max follow-ups reached - no more AI responses');
          }
        }, 300); // Small delay to accumulate audio
      }
      
      else if (evt.type === 'input_audio_buffer.committed') {
        console.log('✅ Audio buffer committed');
        hasUncommittedAudio = false;
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
      if (!isAISpeaking) {
        pcmChunks.push(msg);
        pcmBytes += msg.length;
        hasUncommittedAudio = true;
        
        if (pcmBytes >= batchBytes) {
          sendAppendIfReady();
        }
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
          
          // Reset state
          followupCount = 0;
          hasAskedMainQuestion = false;
          userHasAnswered = false;
          questionAsked = false;
          
          // Clear everything
          resetBuffer();
          ai.send(JSON.stringify({ type: 'conversation.item.clear' }));
          ai.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
          
          // Inject the exact question
          ai.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{
                type: 'input_text',
                text: `Please ask this question exactly as written: "${evt.question}"`
              }]
            }
          }));
          
          // Trigger AI to speak the question
          setTimeout(() => {
            ai.send(JSON.stringify({ 
              type: 'response.create',
              response: {
                modalities: ['text', 'audio'],
                max_output_tokens: 100
              }
            }));
            hasAskedMainQuestion = true;
            questionAsked = true;
          }, 100);
        }
        
        else if (evt?.type === 'stop_ai') {
          console.log('🛑 Force stop AI');
          if (isAISpeaking) {
            ai.send(JSON.stringify({ type: 'response.cancel' }));
            isAISpeaking = false;
          }
          resetBuffer();
        }
        
        // Manual submit - clear buffer safely
        else if (evt?.type === 'submit_answer') {
          console.log('📝 Answer submitted manually');
          
          // Clear any uncommitted audio safely
          if (hasUncommittedAudio && pcmBytes >= batchBytes / 2) {
            safeCommit();
          } else {
            resetBuffer();
            ai.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
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