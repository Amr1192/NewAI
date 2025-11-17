"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Mic, MicOff, ChevronRight, Home, Video, VideoOff, Volume2, VolumeX, 
  Play, Sparkles, AlertTriangle, Check, X, BarChart3, Loader2, Brain,
  MessageSquare, Eye, TrendingUp, Zap
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

interface Feedback {
  clarity: number;
  confidence: number;
  structure: number;
  relevance: number;
  summary: string;
  tips: string[];
  emotional_analysis?: {
    confidence_level: string;
    tone: string;
    filler_words: number;
    speaking_pace: string;
  };
  body_language?: {
    eye_contact: string;
    posture: string;
    facial_expressions: string;
    overall_score: number;
  };
}

interface Answer {
  question: string;
  answer: string;
  ai_followups: string[];
  feedback: Feedback | null;
  words: number;
  duration: number;
}

export default function NextLevelInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.id as string;

  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiFollowups, setAiFollowups] = useState<string[]>([]);
  const [status, setStatus] = useState("Click 'Start Interview' to begin");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [showVideo, setShowVideo] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [questionsSource, setQuestionsSource] = useState<'ai' | 'fallback' | 'unknown'>('unknown');
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  
  // ✅ NEW: AI Conversation State
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [conversationMode, setConversationMode] = useState<'question' | 'followup' | 'waiting'>('waiting');
  const [emotionalState, setEmotionalState] = useState({
    confidence: 50,
    clarity: 50,
    engagement: 50
  });
  const [showEmotionPanel, setShowEmotionPanel] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  
  // ✅ NEW: Audio playback for AI voice
  const aiAudioCtxRef = useRef<AudioContext | null>(null);
  const aiAudioQueueRef = useRef<Int16Array[]>([]);
  const aiAudioPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [userTranscript, aiResponse]);

  useEffect(() => {
    if (!interviewId) {
      setStatus("No interview ID provided");
      return;
    }
    loadInterview();
  }, [interviewId]);

  useEffect(() => {
    if (userTranscript) {
      const words = userTranscript.trim().split(/\s+/).filter((w) => w.length > 0);
      setWordCount(words.length);
      
      // ✅ REAL-TIME EMOTION DETECTION
      analyzeEmotionRealtime(userTranscript);
    }
  }, [userTranscript]);

  useEffect(() => {
    if (isStreaming) {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreaming]);

  useEffect(() => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicMuted && !isAISpeaking;
        console.log('🎤 Mic', (isMicMuted || isAISpeaking) ? 'MUTED' : 'UNMUTED');
      }
    }
  }, [isMicMuted, isAISpeaking]);

  // ✅ REAL-TIME EMOTION ANALYSIS
  const analyzeEmotionRealtime = (text: string) => {
    const words = text.toLowerCase().split(/\s+/);
    
    // Confidence indicators
    const confidentWords = ['definitely', 'absolutely', 'certainly', 'clearly', 'successfully'];
    const hesitantWords = ['maybe', 'perhaps', 'um', 'uh', 'like', 'sort of', 'kind of'];
    
    const confidentCount = words.filter(w => confidentWords.includes(w)).length;
    const hesitantCount = words.filter(w => hesitantWords.includes(w)).length;
    
    const confidence = Math.min(100, 50 + (confidentCount * 10) - (hesitantCount * 5));
    const clarity = Math.min(100, words.length > 20 ? 70 : 50);
    const engagement = Math.min(100, 50 + (words.length / 2));
    
    setEmotionalState({
      confidence: Math.max(0, confidence),
      clarity: Math.max(0, clarity),
      engagement: Math.max(0, engagement)
    });
  };

  const loadInterview = async () => {
    try {
      console.log('📞 Loading interview:', interviewId);
      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}`);
      if (!res.ok) throw new Error("Failed to load interview");

      const data = await res.json();
      console.log('📥 Interview data:', data);
      
      setAllQuestions(data.question_set || []);
      
      const startIndex = data.current_question || 0;
      setCurrentQuestionIndex(startIndex);
      setCurrentQuestion(data.question_set[startIndex] || "");
      
      const firstQuestion = data.question_set[0] || "";
      if (firstQuestion.includes("Tell me about your experience with") || 
          firstQuestion.includes("What are your greatest strengths")) {
        setQuestionsSource('fallback');
        console.warn('⚠️ Using FALLBACK questions');
      } else {
        setQuestionsSource('ai');
        console.log('✅ Using AI-GENERATED questions');
      }
      
      setStatus("Click 'Start Interview' to begin AI conversation");
    } catch (e: any) {
      console.error('❌ Load interview error:', e);
      setStatus("Error loading interview: " + e.message);
    }
  };

  const loadNextQuestion = async () => {
    try {
      console.log('📞 Calling next-question API for interview:', interviewId);
      const res = await fetch(
        `${API_BASE}/api/interviews/${interviewId}/next-question`
      );
      
      if (!res.ok) {
        const text = await res.text();
        console.error('❌ Next question HTTP error:', res.status, text);
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      
      const data = await res.json();
      console.log('📥 Next question response:', data);

      if (data.done) {
        console.log('✅ Interview complete! All questions answered.');
        setInterviewComplete(true);
        await handleFinalize();
        return false;
      }

      console.log(`📝 Loading question ${data.index + 1}/${data.total}: "${data.question}"`);
      
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.index);
      
      return true;
      
    } catch (e: any) {
      console.error('❌ Error loading next question:', e);
      setStatus("Error loading next question: " + e.message);
      return false;
    }
  };

  // ✅ PLAY AI AUDIO
  const playAIAudio = (base64Audio: string) => {
    try {
      if (!aiAudioCtxRef.current) {
        aiAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000
        });
      }
      
      const audioData = atob(base64Audio);
      const buffer = new Int16Array(audioData.length / 2);
      
      for (let i = 0; i < buffer.length; i++) {
        const byte1 = audioData.charCodeAt(i * 2);
        const byte2 = audioData.charCodeAt(i * 2 + 1);
        buffer[i] = (byte2 << 8) | byte1;
      }
      
      aiAudioQueueRef.current.push(buffer);
      
      if (!aiAudioPlayingRef.current) {
        processAIAudioQueue();
      }
    } catch (err) {
      console.error('❌ Audio playback error:', err);
    }
  };

  const processAIAudioQueue = async () => {
    if (aiAudioQueueRef.current.length === 0) {
      aiAudioPlayingRef.current = false;
      return;
    }
    
    aiAudioPlayingRef.current = true;
    const buffer = aiAudioQueueRef.current.shift()!;
    const ctx = aiAudioCtxRef.current!;
    
    const audioBuffer = ctx.createBuffer(1, buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = buffer[i] / 32768.0;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      processAIAudioQueue();
    };
    
    source.start();
  };

  async function startRecording(url: string) {
    try {
      setStatus("Requesting camera and microphone access...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: showVideo 
      });
      mediaStreamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicMuted;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus("Connecting to AI interviewer...");
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        setStatus("Setting up AI conversation...");
        const AudioCtx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 24000 }); // ✅ 24kHz for gpt-realtime
        audioCtxRef.current = ctx;

        if (ctx.state === "suspended") await ctx.resume();

        await ctx.audioWorklet.addModule("/worklet-processor.js");
        const src = ctx.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(ctx, "pcm16-sender");
        workletRef.current = worklet;

        src.connect(worklet);

        try {
          ws.send(JSON.stringify({ type: "config", sampleRate: ctx.sampleRate }));
        } catch {}

        worklet.port.onmessage = (e: MessageEvent) => {
          const d = e.data as any;
          let ab: ArrayBuffer | null = null;

          if (d instanceof ArrayBuffer) {
            ab = d;
          } else if (ArrayBuffer.isView(d) && d.buffer instanceof ArrayBuffer) {
            ab =
              d.byteLength === d.buffer.byteLength
                ? d.buffer
                : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
          } else if (d?.buffer instanceof ArrayBuffer) {
            ab = d.buffer;
          }

          if (ab && ws.readyState === WebSocket.OPEN && !isMicMuted && !isAISpeaking) {
            ws.send(ab);
          }
        };

        setStatus("AI interviewer ready");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as any);

          // ✅ USER TRANSCRIPT
          if (data.type === "user_transcript") {
            setUserTranscript((t) => t + data.delta);
            console.log('🎤 You:', data.delta);
          } 
          else if (data.type === "user_transcript_complete") {
            setUserTranscript((t) => t + " ");
            console.log('✅ You finished speaking');
          }
          
          // ✅ AI RESPONSE (text)
          else if (data.type === "ai_response") {
            setAiResponse((t) => t + data.delta);
            console.log('🤖 AI:', data.delta);
            
            // Track follow-up questions
            if (data.delta.includes('?')) {
              setConversationMode('followup');
            }
          }
          else if (data.type === "ai_response_complete") {
            console.log('✅ AI finished response');
            setAiFollowups((prev) => [...prev, data.text]);
          }
          
          // ✅ AI AUDIO
          else if (data.type === "ai_audio") {
            setIsAISpeaking(true);
            playAIAudio(data.audio);
          }
          else if (data.type === "ai_audio_done") {
            setIsAISpeaking(false);
            console.log('🔊 AI finished speaking - your turn!');
            setStatus("Your turn to speak...");
          }
          
          else if (data.type === "ai_turn_complete") {
            console.log('✅ Conversation turn complete');
            setConversationMode('waiting');
          }
          
          else if (data.type === "ai_ready") {
            console.log('✅ AI interviewer initialized');
          }
          
        } catch {}
      };

      ws.onclose = () => {
        console.log('🔴 WebSocket closed');
        stopRecording();
      };

      ws.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
        stopRecording();
      };
    } catch (err) {
      console.error('❌ Recording error:', err);
      setStatus("Error: " + (err as Error).message);
      stopRecording();
    }
  }

  async function stopRecording() {
    setIsStreaming(false);

    try {
      wsRef.current?.close();
    } catch {}

    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}

    try {
      workletRef.current?.disconnect();
    } catch {}

    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        await audioCtxRef.current.close();
      }
    } catch {}

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    mediaStreamRef.current = null;
  }

  async function handleStartOrNext() {
    if (isProcessingRef.current || isLoadingNext || isAnalyzing) {
      console.log('⏳ Already processing, ignoring click');
      return;
    }

    isProcessingRef.current = true;

    try {
      if (!hasStarted) {
        await handleStartInterview();
      } else if (!isSubmitted) {
        await handleSubmitAnswer();
      } else {
        await handleNextQuestion();
      }
    } catch (error) {
      console.error('❌ Error in handleStartOrNext:', error);
      setStatus("An error occurred. Please try again.");
    } finally {
      isProcessingRef.current = false;
    }
  }

  async function handleStartInterview() {
    setHasStarted(true);
    setStatus("AI interviewer is starting...");
    
    await startRecordingSession();
    
    // ✅ Send the question to AI
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'start_question',
        question: currentQuestion
      }));
      setConversationMode('question');
    }
  }

  async function handleSubmitAnswer() {
    if (!userTranscript.trim()) {
      setStatus("Please provide an answer first");
      return;
    }

    if (isStreaming) {
      await stopRecording();
    }
    
    await submitAnswer();
    setIsSubmitted(true);
  }

  async function handleNextQuestion() {
    setIsLoadingNext(true);
    setShowFeedbackPopup(false);
    setStatus("Loading next question...");
    
    if (isStreaming) {
      await stopRecording();
    }
    
    setUserTranscript("");
    setAiResponse("");
    setAiFollowups([]);
    setFeedback(null);
    setIsSubmitted(false);
    setWordCount(0);
    setConversationMode('waiting');
    
    const success = await loadNextQuestion();
    
    if (!success) {
      setIsLoadingNext(false);
      return;
    }
    
    await startRecordingSession();
    
    // ✅ Send new question to AI
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'start_question',
        question: currentQuestion
      }));
      setConversationMode('question');
    }
    
    setIsLoadingNext(false);
  }

  async function startRecordingSession() {
    try {
      const res = await fetch(
        `${API_BASE}/api/interviews/${interviewId}/rt/start`,
        { method: "POST" }
      );
      
      if (!res.ok) {
        throw new Error(`Failed to start recording session: ${res.status}`);
      }
      
      const data = await res.json();
      setSessionId(data.sessionId);
      
      await startRecording(data.node_ws_url);
      setIsStreaming(true);
    } catch (e: any) {
      console.error('❌ Start recording error:', e);
      setStatus("Failed to start recording: " + e.message);
      throw e;
    }
  }

  async function submitAnswer() {
    if (!userTranscript.trim()) {
      return;
    }

    setIsAnalyzing(true);
    setStatus("Analyzing your answer with AI...");

    try {
      // ✅ ENHANCED: Send video frame for body language analysis
      let videoFrame = null;
      if (videoRef.current && showVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0, 640, 480);
        videoFrame = canvas.toDataURL('image/jpeg', 0.8);
      }

      const res = await fetch(
        `${API_BASE}/api/interviews/${interviewId}/rt/submit-answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId,
            transcript: userTranscript,
            question_index: currentQuestionIndex,
            ai_followups: aiFollowups,
            video_frame: videoFrame, // ✅ For body language analysis
            emotional_metrics: emotionalState
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to submit answer");

      const data = await res.json();
      const answerFeedback = data.feedback as Feedback;
      
      setFeedback(answerFeedback);
      setAnswers((prev) => [
        ...prev,
        {
          question: currentQuestion,
          answer: userTranscript,
          ai_followups: aiFollowups,
          feedback: answerFeedback,
          words: wordCount,
          duration: duration
        },
      ]);

      setStatus("Answer analyzed! Click 'Next Question' to continue");
      setShowFeedbackPopup(true);
    } catch (e: any) {
      console.error('❌ Submit answer error:', e);
      setStatus("Error analyzing answer: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleFinalize = async () => {
    try {
      console.log('🏁 Finalizing interview...');
      await stopRecording();
      
      const res = await fetch(
        `${API_BASE}/api/interviews/${interviewId}/finalize`,
        { method: "POST" }
      );
      const data = await res.json();
      console.log('📥 Finalize response:', data);
      
      router.push(`/interviews/${interviewId}/report`);
    } catch (e: any) {
      console.error('❌ Finalize error:', e);
      setStatus("Error finalizing interview: " + e.message);
    }
  };

  const handleExit = async () => {
    if (userTranscript.trim() && !feedback) {
      await submitAnswer();
    }
    await handleFinalize();
  };

  const toggleMicMute = () => {
    setIsMicMuted(!isMicMuted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  useEffect(() => {
    return () => {
      stopRecording();
      isProcessingRef.current = false;
    };
  }, []);

  if (!interviewId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="p-8">
          <p className="text-red-500">No interview ID provided</p>
          <Button onClick={() => router.push("/interview-setup")} className="mt-4">
            Start New Interview
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            <h1 className="text-lg font-bold">AI Interview • Next Level</h1>
          </div>
          <span className="text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {allQuestions.length}
          </span>
          
          {questionsSource === 'ai' && (
            <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded">
              <Sparkles size={12} />
              AI Questions
            </span>
          )}
          
          <span className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-1 rounded">
            <Zap size={12} />
            Voice AI Active
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={handleExit} disabled={isLoadingNext}>
          <Home className="mr-2 h-4 w-4" />
          Exit & View Report
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side - Video & AI Conversation */}
        <div className="w-2/3 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Question Card */}
          <Card className="p-4 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Current Question</h3>
              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                {currentQuestionIndex + 1}/{allQuestions.length}
              </span>
            </div>
            <p className="text-lg font-semibold">{currentQuestion || "Loading..."}</p>
            
            {/* AI Conversation Indicator */}
            {isAISpeaking && (
              <div className="mt-3 flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                <MessageSquare className="h-4 w-4 animate-pulse" />
                <span>AI is speaking...</span>
              </div>
            )}
            
            {conversationMode === 'followup' && !isAISpeaking && (
              <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                <MessageSquare className="h-4 w-4" />
                <span>AI asked a follow-up question</span>
              </div>
            )}
          </Card>

          {/* Video Section */}
          <Card className="flex-1 overflow-hidden flex flex-col min-h-[400px]">
            <div className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden">
              {showVideo && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-b from-black/40 via-transparent to-black/60">
                <div className="flex justify-between items-start">
                  <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg">
                    {isStreaming ? (
                      <div className="flex items-center gap-2 text-white text-sm">
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="font-medium">Live</span>
                        <span className="text-white/70">• {formatTime(duration)}</span>
                        {isAISpeaking && <span className="text-purple-400">• AI Speaking</span>}
                        {isMicMuted && <span className="text-red-400">• MUTED</span>}
                      </div>
                    ) : isLoadingNext ? (
                      <div className="flex items-center gap-2 text-white text-sm">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Loading next question...</span>
                      </div>
                    ) : (
                      <span className="text-white/70 text-sm">{status}</span>
                    )}
                  </div>
                  
                  {/* Real-time Emotion Panel */}
                  {showEmotionPanel && hasStarted && (
                    <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-3 w-3 text-green-400" />
                        <span className="text-xs text-white font-medium">Live Analysis</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/70 w-20">Confidence:</span>
                          <div className="flex-1 bg-white/20 rounded-full h-1.5 w-16">
                            <div 
                              className="bg-green-400 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${emotionalState.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs text-white">{emotionalState.confidence}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/70 w-20">Clarity:</span>
                          <div className="flex-1 bg-white/20 rounded-full h-1.5 w-16">
                            <div 
                              className="bg-blue-400 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${emotionalState.clarity}%` }}
                            />
                          </div>
                          <span className="text-xs text-white">{emotionalState.clarity}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Control Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleStartOrNext}
              disabled={isAnalyzing || interviewComplete || isLoadingNext || isAISpeaking}
              size="lg" 
              className="flex-1"
            >
              {isLoadingNext ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading...
                </>
              ) : !hasStarted ? (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Start AI Interview
                </>
              ) : !isSubmitted ? (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  Submit Answer
                </>
              ) : (
                <>
                  <ChevronRight className="mr-2 h-5 w-5" />
                  Next Question
                </>
              )}
            </Button>

            <Button
              variant={isMicMuted ? "destructive" : "default"}
              size="lg"
              onClick={toggleMicMute}
              disabled={!isStreaming || isLoadingNext}
              title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              variant={showVideo ? "default" : "outline"}
              size="lg"
              onClick={() => setShowVideo(!showVideo)}
              disabled={isLoadingNext}
              title={showVideo ? "Disable Camera" : "Enable Camera"}
            >
              {showVideo ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Right Side - Conversation Transcript */}
        <div className="w-1/3 border-l border-border flex flex-col overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                AI Conversation
              </h3>
              
              {feedback && !isLoadingNext && (
                <button
                  onClick={() => setShowFeedbackPopup(!showFeedbackPopup)}
                  className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/30 transition"
                >
                  <BarChart3 size={14} />
                  View Feedback
                </button>
              )}
            </div>
            
            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!hasStarted ? (
                  <p className="text-sm text-muted-foreground italic text-center mt-8">
                    Click 'Start AI Interview' to begin natural conversation
                  </p>
                ) : (
                  <>
                    {/* AI Response */}
                    {aiResponse && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Brain className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">
                              AI Interviewer
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {aiResponse}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* User Response */}
                    {userTranscript && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Mic className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">
                              Your Answer
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {userTranscript}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {isAISpeaking && (
                      <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>AI is speaking...</span>
                      </div>
                    )}
                    
                    {!userTranscript && !aiResponse && !isAISpeaking && (
                      <p className="text-sm text-muted-foreground italic text-center mt-8">
                        {isLoadingNext ? "Loading next question..." : "Listening..."}
                      </p>
                    )}
                  </>
                )}
                <div ref={transcriptEndRef} />
              </div>
              
              {(userTranscript || aiResponse) && (
                <div className="border-t border-border p-3 bg-muted/50">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{wordCount} words spoken</span>
                    {isStreaming && <span>{formatTime(duration)}</span>}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* FLOATING FEEDBACK POPUP */}
          {feedback && showFeedbackPopup && !isLoadingNext && (
            <div className="absolute bottom-4 right-4 w-80 z-50 animate-in slide-in-from-bottom-4">
              <Card className="bg-white dark:bg-gray-900 border-2 border-blue-500 shadow-2xl">
                <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-sm">AI Analysis</span>
                  </div>
                  <button
                    onClick={() => setShowFeedbackPopup(false)}
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {[
                    { label: "Clarity", value: feedback.clarity },
                    { label: "Confidence", value: feedback.confidence },
                    { label: "Structure", value: feedback.structure },
                    { label: "Relevance", value: feedback.relevance },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-medium">{item.label}</span>
                        <span className={`font-bold text-sm ${getScoreColor(item.value)}`}>
                          {item.value}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-500 ${getScoreBgColor(item.value)}`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 pb-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <p className="text-xs mb-2">{feedback.summary}</p>
                    {feedback.tips && feedback.tips.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Tips:</p>
                        <ul className="text-xs space-y-0.5">
                          {feedback.tips.map((tip, idx) => (
                            <li key={idx} className="flex items-start gap-1">
                              <span className="text-blue-500">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {feedback.emotional_analysis && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">Emotional Analysis:</p>
                        <p className="text-xs">
                          <span className="font-medium">Confidence:</span> {feedback.emotional_analysis.confidence_level}
                        </p>
                        <p className="text-xs">
                          <span className="font-medium">Tone:</span> {feedback.emotional_analysis.tone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}