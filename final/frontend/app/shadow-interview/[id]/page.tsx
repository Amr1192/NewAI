"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Mic, MicOff, ChevronRight, Home, Video, VideoOff, 
  Play, Check, X, BarChart3, Loader2, Brain, Volume2
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
  const [transcript, setTranscript] = useState("");
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
  const [isSpeaking, setIsSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    if (!interviewId) {
      setStatus("No interview ID provided");
      return;
    }
    loadInterview();
  }, [interviewId]);

  useEffect(() => {
    if (transcript) {
      const words = transcript.trim().split(/\s+/).filter((w) => w.length > 0);
      setWordCount(words.length);
    }
  }, [transcript]);

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
        audioTrack.enabled = !isMicMuted && !isSpeaking;
      }
    }
  }, [isMicMuted, isSpeaking]);

  // ✅ Speak question when it changes
  useEffect(() => {
    if (currentQuestion && hasStarted && !isLoadingNext) {
      speakQuestion(currentQuestion);
    }
  }, [currentQuestion, hasStarted, isLoadingNext]);

  const speakQuestion = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onstart = () => {
          console.log('🔊 Speaking question');
          setIsSpeaking(true);
          setStatus("Listen to the question...");
        };
        
        utterance.onend = () => {
          console.log('✅ Question spoken - unmuting mic');
          setIsSpeaking(false);
          setStatus("Your turn - speak your answer");
          
          // ✅ FIX: Force unmute mic after question
          if (mediaStreamRef.current && !isMicMuted) {
            const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = true;
              console.log('🎤 Mic ENABLED for your answer');
            }
          }
        };
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Female')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        
        window.speechSynthesis.speak(utterance);
      }, 100);
    }
  };

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

  async function startRecording(url: string) {
    try {
      setStatus("Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true 
        },
        video: showVideo 
      });
      mediaStreamRef.current = stream;
      
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) audioTrack.enabled = !isMicMuted && !isSpeaking;
      
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
          if (ab && ws.readyState === WebSocket.OPEN && !isMicMuted && !isSpeaking) {
            ws.send(ab);
          }
        };
        setStatus("Connected - ready to start");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as any);
          
          if (data.type === "transcript") {
            const newText = data.delta;
            // ✅ Prevent adding duplicate text
            setTranscript((prev) => {
              // Check if this text is already at the end
              if (prev.endsWith(newText)) {
                console.log('⚠️ Skipping duplicate:', newText);
                return prev;
              }
              return prev + newText;
            });
          } else if (data.type === "transcript_end") {
            console.log('✅ Transcript complete');
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
  }

  async function handleSubmitAnswer() {
    const finalAnswer = transcript.trim();
    if (!finalAnswer || finalAnswer.length < 10) {
      setStatus("Answer too short (min 10 characters)");
      return;
    }
    
    if (isStreaming) await stopRecording();
    await submitAnswer(finalAnswer);
    setIsSubmitted(true);
  }

  async function handleNextQuestion() {
    setIsLoadingNext(true);
    setShowFeedbackPopup(false);
    
    if (isStreaming) await stopRecording();
    
    setTranscript("");
    setFeedback(null);
    setIsSubmitted(false);
    setWordCount(0);
    
    const success = await loadNextQuestion();
    if (!success) { setIsLoadingNext(false); return; }
    
    await startRecordingSession();
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
    setStatus("Analyzing your answer...");
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
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const data = await res.json();
      if (!data.feedback) throw new Error("No feedback received");
      
      const answerFeedback = data.feedback as Feedback;
      setFeedback(answerFeedback);
      setAnswers((prev) => [...prev, {
        question: currentQuestion,
        answer: finalTranscript,
        feedback: answerFeedback,
        words: wordCount,
        duration: duration
      }]);
      setStatus("Analysis complete! Click 'Next Question'");
      setShowFeedbackPopup(true);
    } catch (e: any) {
      console.error('Submit error:', e);
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
    const finalAnswer = transcript.trim();
    if (finalAnswer && !feedback) await submitAnswer(finalAnswer);
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
      window.speechSynthesis.cancel();
      isProcessingRef.current = false;
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

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Brain className="h-5 w-5 text-purple-500" />
          <h1 className="text-lg font-bold">AI Interview</h1>
          <span className="text-sm text-muted-foreground">Q {currentQuestionIndex + 1}/{allQuestions.length}</span>
          {isSpeaking && (
            <span className="text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-2 py-1 rounded flex items-center gap-1">
              <Volume2 className="h-3 w-3" />
              Speaking
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
            {isSpeaking && (
              <div className="mt-3 flex items-center gap-2 text-sm text-purple-600">
                <Volume2 className="h-4 w-4 animate-pulse" />
                AI is reading the question...
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
            <Button onClick={handleStartOrNext} disabled={isAnalyzing || interviewComplete || isLoadingNext || isSpeaking} size="lg" className="flex-1">
              {isLoadingNext ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading...</> : 
               !hasStarted ? <><Play className="mr-2 h-5 w-5" />Start</> :
               !isSubmitted ? <><Check className="mr-2 h-5 w-5" />Submit</> :
               <><ChevronRight className="mr-2 h-5 w-5" />Next</>}
            </Button>
            <Button variant={isMicMuted ? "destructive" : "default"} size="lg" onClick={() => setIsMicMuted(!isMicMuted)} disabled={!isStreaming || isSpeaking}>
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
              <h3 className="text-sm font-semibold text-muted-foreground">Your Answer</h3>
              {feedback && !isLoadingNext && (
                <button onClick={() => setShowFeedbackPopup(!showFeedbackPopup)} className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full">
                  <BarChart3 size={14} className="inline mr-1" />Feedback
                </button>
              )}
            </div>
            
            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                {!hasStarted ? (
                  <p className="text-sm text-muted-foreground italic text-center mt-8">Click 'Start' to begin</p>
                ) : transcript ? (
                  <p className="text-sm whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">{isSpeaking ? "Listening to question..." : "Start speaking your answer..."}</p>
                )}
                <div ref={transcriptEndRef} />
              </div>
              {transcript && (
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