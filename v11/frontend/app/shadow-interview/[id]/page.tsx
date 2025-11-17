"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Mic, MicOff, ChevronRight, Home, Video, VideoOff, 
  Play, Sparkles, Check, X, BarChart3, Loader2, Brain,
  MessageSquare, TrendingUp, Zap, StopCircle
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
}

interface Answer {
  question: string;
  answer: string;
  ai_followups: string[];
  feedback: Feedback | null;
  words: number;
  duration: number;
}

export default function InterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.id as string;

  const [isStreaming, setIsStreaming] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [userTranscriptLive, setUserTranscriptLive] = useState("");
  const [userTranscriptFinal, setUserTranscriptFinal] = useState("");
  const [aiResponseLive, setAiResponseLive] = useState("");
  const [aiResponseFinal, setAiResponseFinal] = useState("");
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
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [followupCount, setFollowupCount] = useState(0);
  const [autoAdvanceTimer, setAutoAdvanceTimer] = useState<NodeJS.Timeout | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);
  const aiAudioCtxRef = useRef<AudioContext | null>(null);
  const aiAudioQueueRef = useRef<Int16Array[]>([]);
  const aiAudioPlayingRef = useRef<boolean>(false);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [userTranscriptLive, aiResponseLive]);

  useEffect(() => {
    if (!interviewId) {
      setStatus("No interview ID provided");
      return;
    }
    loadInterview();
  }, [interviewId]);

  useEffect(() => {
    if (userTranscriptFinal) {
      const words = userTranscriptFinal.trim().split(/\s+/).filter((w) => w.length > 0);
      setWordCount(words.length);
    }
  }, [userTranscriptFinal]);

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
      }
    }
  }, [isMicMuted, isAISpeaking]);

  const loadInterview = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}`);
      if (!res.ok) throw new Error("Failed to load interview");
      const data = await res.json();
      setAllQuestions(data.question_set || []);
      const startIndex = data.current_question || 0;
      setCurrentQuestionIndex(startIndex);
      setCurrentQuestion(data.question_set[startIndex] || "");
      setStatus("Click 'Start Interview' to begin");
    } catch (e: any) {
      setStatus("Error: " + e.message);
    }
  };

  const loadNextQuestion = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}/next-question`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.done) {
        setInterviewComplete(true);
        await handleFinalize();
        return false;
      }
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.index);
      return true;
    } catch (e: any) {
      setStatus("Error: " + e.message);
      return false;
    }
  };

  const playAIAudio = (base64Audio: string) => {
    try {
      if (!aiAudioCtxRef.current) {
        aiAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
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
      console.error('Audio error:', err);
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
    source.onended = () => processAIAudioQueue();
    source.start();
  };

  const forceStopAI = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop_ai' }));
      setIsAISpeaking(false);
      aiAudioQueueRef.current = [];
    }
  };

  async function startRecording(url: string) {
    try {
      setStatus("Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: showVideo 
      });
      mediaStreamRef.current = stream;
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !isMicMuted;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 24000 });
        audioCtxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        await ctx.audioWorklet.addModule("/worklet-processor.js");
        const src = ctx.createMediaStreamSource(stream);
        const worklet = new AudioWorkletNode(ctx, "pcm16-sender");
        workletRef.current = worklet;
        src.connect(worklet);
        
        ws.send(JSON.stringify({ type: "config", sampleRate: ctx.sampleRate }));

        worklet.port.onmessage = (e: MessageEvent) => {
          const d = e.data as any;
          let ab: ArrayBuffer | null = null;
          if (d instanceof ArrayBuffer) {
            ab = d;
          } else if (ArrayBuffer.isView(d) && d.buffer instanceof ArrayBuffer) {
            ab = d.byteLength === d.buffer.byteLength ? d.buffer : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
          } else if (d?.buffer instanceof ArrayBuffer) {
            ab = d.buffer;
          }
          if (ab && ws.readyState === WebSocket.OPEN && !isMicMuted && !isAISpeaking) {
            ws.send(ab);
          }
        };
        setStatus("AI ready");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as any);
          
          if (data.type === "user_transcript_delta") {
            setUserTranscriptLive((prev) => prev + data.delta);
          } else if (data.type === "user_transcript_complete") {
            setUserTranscriptFinal(data.text);
          } else if (data.type === "ai_response_delta") {
            setAiResponseLive((prev) => prev + data.delta);
          } else if (data.type === "ai_response_complete") {
            setAiResponseFinal(data.text);
            setAiFollowups((prev) => [...prev, data.text]);
            if (data.followup_count !== undefined) {
              setFollowupCount(data.followup_count);
            }
          } else if (data.type === "ai_audio") {
            setIsAISpeaking(true);
            playAIAudio(data.audio);
          } else if (data.type === "ai_audio_done") {
            setIsAISpeaking(false);
            setStatus("Your turn...");
          } else if (data.type === "auto_advance") {
            setStatus("Moving to next question in 3 seconds...");
            if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
            const timer = setTimeout(async () => {
              if (!isSubmitted) await handleSubmitAnswer();
              await handleNextQuestion();
            }, 3000);
            setAutoAdvanceTimer(timer);
          } else if (data.type === "user_speaking_started") {
            setIsUserSpeaking(true);
          } else if (data.type === "user_speaking_stopped") {
            setIsUserSpeaking(false);
          } else if (data.type === "error") {
            console.error('WebSocket error:', data.message);
          }
        } catch (err) {
          console.error('Parse error:', err);
        }
      };

      ws.onclose = () => stopRecording();
      ws.onerror = (err) => { console.error('WS error:', err); stopRecording(); };
    } catch (err) {
      console.error('Recording error:', err);
      setStatus("Error: " + (err as Error).message);
      stopRecording();
    }
  }

  async function stopRecording() {
    setIsStreaming(false);
    try { wsRef.current?.close(); } catch {}
    try { mediaStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    try { workletRef.current?.disconnect(); } catch {}
    try { if (audioCtxRef.current?.state !== "closed") await audioCtxRef.current?.close(); } catch {}
    if (videoRef.current) videoRef.current.srcObject = null;
    mediaStreamRef.current = null;
  }

  async function handleStartOrNext() {
    if (isProcessingRef.current || isLoadingNext || isAnalyzing) return;
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); setAutoAdvanceTimer(null); }
    isProcessingRef.current = true;
    try {
      if (!hasStarted) await handleStartInterview();
      else if (!isSubmitted) await handleSubmitAnswer();
      else await handleNextQuestion();
    } catch (error) {
      console.error('Error:', error);
      setStatus("Error occurred");
    } finally {
      isProcessingRef.current = false;
    }
  }

  async function handleStartInterview() {
    setHasStarted(true);
    await startRecordingSession();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_question', question: currentQuestion }));
    }
  }

  async function handleSubmitAnswer() {
    const finalAnswer = userTranscriptFinal || userTranscriptLive;
    if (!finalAnswer.trim() || finalAnswer.trim().length < 10) {
      setSubmitError("Answer too short (min 10 characters)");
      return;
    }
    if (isStreaming) await stopRecording();
    setSubmitError(null);
    await submitAnswer(finalAnswer);
    setIsSubmitted(true);
  }

  async function handleNextQuestion() {
    setIsLoadingNext(true);
    setShowFeedbackPopup(false);
    if (autoAdvanceTimer) { clearTimeout(autoAdvanceTimer); setAutoAdvanceTimer(null); }
    if (isStreaming) await stopRecording();
    
    setUserTranscriptLive("");
    setUserTranscriptFinal("");
    setAiResponseLive("");
    setAiResponseFinal("");
    setAiFollowups([]);
    setFeedback(null);
    setIsSubmitted(false);
    setWordCount(0);
    setFollowupCount(0);
    setSubmitError(null);
    
    const success = await loadNextQuestion();
    if (!success) { setIsLoadingNext(false); return; }
    
    await startRecordingSession();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'start_question', question: currentQuestion }));
    }
    setIsLoadingNext(false);
  }

  async function startRecordingSession() {
    try {
      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}/rt/start`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to start: ${res.status}`);
      const data = await res.json();
      setSessionId(data.sessionId);
      await startRecording(data.node_ws_url);
      setIsStreaming(true);
    } catch (e: any) {
      console.error('Start error:', e);
      setStatus("Failed: " + e.message);
      throw e;
    }
  }

  async function submitAnswer(finalTranscript: string) {
    setIsAnalyzing(true);
    setStatus("Analyzing...");
    try {
      let videoFrame = null;
      if (videoRef.current && showVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0, 640, 480);
        videoFrame = canvas.toDataURL('image/jpeg', 0.8);
      }

      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}/rt/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          transcript: finalTranscript,
          question_index: currentQuestionIndex,
          ai_followups: aiFollowups,
          video_frame: videoFrame,
          emotional_metrics: {}
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = "Failed to submit";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = `HTTP ${res.status}: ${errorText.substring(0, 100)}`;
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      if (!data.feedback) throw new Error("No feedback received");
      
      const answerFeedback = data.feedback as Feedback;
      setFeedback(answerFeedback);
      setAnswers((prev) => [...prev, {
        question: currentQuestion,
        answer: finalTranscript,
        ai_followups: aiFollowups,
        feedback: answerFeedback,
        words: wordCount,
        duration: duration
      }]);
      setStatus("Analyzed! Click 'Next Question'");
      setShowFeedbackPopup(true);
    } catch (e: any) {
      console.error('Submit error:', e);
      setSubmitError(e.message);
      setStatus("Error: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleFinalize = async () => {
    try {
      await stopRecording();
      await fetch(`${API_BASE}/api/interviews/${interviewId}/finalize`, { method: "POST" });
      router.push(`/interviews/${interviewId}/report`);
    } catch (e: any) {
      console.error('Finalize error:', e);
    }
  };

  const handleExit = async () => {
    const finalAnswer = userTranscriptFinal || userTranscriptLive;
    if (finalAnswer.trim() && !feedback) await submitAnswer(finalAnswer);
    await handleFinalize();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number) => score >= 80 ? "text-green-500" : score >= 60 ? "text-yellow-500" : "text-red-500";
  const getScoreBgColor = (score: number) => score >= 80 ? "bg-green-500" : score >= 60 ? "bg-yellow-500" : "bg-red-500";

  useEffect(() => {
    return () => {
      stopRecording();
      isProcessingRef.current = false;
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    };
  }, []);

  if (!interviewId) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Card className="p-8">
          <p className="text-red-500">No interview ID</p>
          <Button onClick={() => router.push("/interview-setup")} className="mt-4">Start New</Button>
        </Card>
      </div>
    );
  }

  const displayTranscript = userTranscriptLive || userTranscriptFinal;
  const displayAIResponse = aiResponseLive || aiResponseFinal;

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-purple-500" />
          <h1 className="text-lg font-bold">AI Interview</h1>
          <span className="text-sm text-muted-foreground">Q {currentQuestionIndex + 1}/{allQuestions.length}</span>
          {followupCount > 0 && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
              {followupCount} follow-up
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleExit} disabled={isLoadingNext}>
          <Home className="mr-2 h-4 w-4" />Exit
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-2/3 p-4 flex flex-col gap-4">
          <Card className="p-4 shrink-0">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Question {currentQuestionIndex + 1}/{allQuestions.length}</h3>
            <p className="text-lg font-semibold">{currentQuestion || "Loading..."}</p>
            {submitError && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">⚠️ {submitError}</div>
            )}
            {isAISpeaking && (
              <div className="mt-3 flex items-center gap-2 text-sm text-purple-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>AI speaking...</span>
                <Button size="sm" variant="outline" onClick={forceStopAI}>
                  <StopCircle className="h-3 w-3 mr-1" />Stop
                </Button>
              </div>
            )}
            {isUserSpeaking && (
              <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                <Mic className="h-4 w-4 animate-pulse" />Listening...
              </div>
            )}
          </Card>

          <Card className="flex-1 overflow-hidden flex flex-col min-h-[400px]">
            <div className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden">
              {showVideo && <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />}
              <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-b from-black/40 to-black/60">
                <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg w-fit">
                  {isStreaming ? (
                    <div className="flex items-center gap-2 text-white text-sm">
                      <span className="flex h-2 w-2">
                        <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-400 opacity-75" />
                        <span className="relative h-2 w-2 rounded-full bg-red-500" />
                      </span>
                      <span>Live • {formatTime(duration)}</span>
                      {isAISpeaking && <span className="text-purple-400">• AI</span>}
                      {isUserSpeaking && <span className="text-blue-400">• You</span>}
                    </div>
                  ) : isLoadingNext ? (
                    <div className="flex items-center gap-2 text-white text-sm">
                      <Loader2 className="h-3 w-3 animate-spin" />Loading...
                    </div>
                  ) : (
                    <span className="text-white/70 text-sm">{status}</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleStartOrNext} disabled={isAnalyzing || interviewComplete || isLoadingNext || isAISpeaking} size="lg" className="flex-1">
              {isLoadingNext ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 
               !hasStarted ? <><Play className="mr-2 h-5 w-5" />Start</> :
               !isSubmitted ? <><Check className="mr-2 h-5 w-5" />Submit</> :
               <><ChevronRight className="mr-2 h-5 w-5" />Next</>}
            </Button>
            <Button variant={isMicMuted ? "destructive" : "default"} size="lg" onClick={() => setIsMicMuted(!isMicMuted)} disabled={!isStreaming}>
              {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button variant={showVideo ? "default" : "outline"} size="lg" onClick={() => setShowVideo(!showVideo)} disabled={isLoadingNext}>
              {showVideo ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        <div className="w-1/3 border-l border-border flex flex-col overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Conversation</h3>
              {feedback && !isLoadingNext && (
                <button onClick={() => setShowFeedbackPopup(!showFeedbackPopup)} className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full">
                  <BarChart3 size={14} className="inline mr-1" />Feedback
                </button>
              )}
            </div>
            
            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {!hasStarted ? (
                  <p className="text-sm text-muted-foreground italic text-center mt-8">Click 'Start' to begin</p>
                ) : (
                  <>
                    {displayAIResponse && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Brain className="h-4 w-4 text-purple-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1">AI {isAISpeaking && "• Speaking"}</p>
                            <p className="text-sm">{displayAIResponse}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {displayTranscript && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Mic className="h-4 w-4 text-blue-500 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1">You {isUserSpeaking && "• Speaking"}</p>
                            <p className="text-sm">{displayTranscript}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={transcriptEndRef} />
              </div>
              {(displayTranscript || displayAIResponse) && (
                <div className="border-t p-3 bg-muted/50">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{wordCount} words</span>
                    {isStreaming && <span>{formatTime(duration)}</span>}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {feedback && showFeedbackPopup && !isLoadingNext && (
            <div className="absolute bottom-4 right-4 w-80 z-50">
              <Card className="border-2 border-blue-500 shadow-2xl">
                <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-sm">Analysis</span>
                  </div>
                  <button onClick={() => setShowFeedbackPopup(false)}>
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
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium">{item.label}</span>
                        <span className={`font-bold text-sm ${getScoreColor(item.value)}`}>{item.value}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${getScoreBgColor(item.value)}`} style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    <p className="text-xs mb-2">{feedback.summary}</p>
                    {feedback.tips?.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs font-semibold mb-1">Tips:</p>
                        <ul className="text-xs space-y-0.5">
                          {feedback.tips.map((tip, idx) => (
                            <li key={idx}><span className="text-blue-500">•</span> {tip}</li>
                          ))}
                        </ul>
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