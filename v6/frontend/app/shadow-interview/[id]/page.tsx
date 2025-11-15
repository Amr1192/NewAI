"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic, MicOff, ChevronRight, Home, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
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
}

export default function ShadowInterviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.id as string;

  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Loading interview...");
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
  const [audioEnabled, setAudioEnabled] = useState(true); // NEW: TTS control

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll transcript
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

  // NEW: Speak question when it changes
  useEffect(() => {
    if (currentQuestion && currentQuestion !== "" && audioEnabled) {
      speakQuestion(currentQuestion);
    }
  }, [currentQuestion, audioEnabled]);

  // NEW: Text-to-Speech function (FREE - uses browser)
  const speakQuestion = (text: string) => {
    // Stop any ongoing speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      // Wait a tiny bit to ensure cancel completes
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; // Slightly slower for clarity
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Optional: Choose voice (you can list available voices)
        const voices = window.speechSynthesis.getVoices();
        // Prefer female voice if available
        const preferredVoice = voices.find(v => v.name.includes('Female')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        
        window.speechSynthesis.speak(utterance);
      }, 100);
    }
  };

  // NEW: Stop speech
  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const loadInterview = async () => {
    try {
      console.log('📞 Loading interview:', interviewId);
      const res = await fetch(`${API_BASE}/api/interviews/${interviewId}`);
      if (!res.ok) throw new Error("Failed to load interview");

      const data = await res.json();
      console.log('📥 Interview data:', data);
      
      setAllQuestions(data.question_set || []);
      setCurrentQuestionIndex(data.current_question || 0);
      setCurrentQuestion(data.question_set[data.current_question || 0] || "");
      setStatus("Ready to start");
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
        setStatus("Interview complete! Click to view report.");
        stopSpeech(); // Stop any ongoing speech
        return;
      }

      console.log(`📝 Loading question ${data.index + 1}/${data.total}: "${data.question}"`);
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.index);
      setStatus("Ready to answer");
      setTranscript("");
      setFeedback(null);
    } catch (e: any) {
      console.error('❌ Error loading next question:', e);
      setStatus("Error loading next question: " + e.message);
      alert(`Error loading next question: ${e.message}\n\nCheck console for details.`);
    }
  };

  async function startRecording(url: string) {
    try {
      // Stop speech when starting to record
      stopSpeech();
      
      setStatus("Requesting camera and microphone access...");
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: true 
      });
      mediaStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus("Connecting to server...");
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = async () => {
        setStatus("Setting up audio processing...");
        const AudioCtx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 16000 });
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

          if (ab && ws.readyState === WebSocket.OPEN) {
            ws.send(ab);
          }
        };

        setStatus("Recording... speak your answer");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as any);
          console.log('📥 WebSocket message:', data);

          if (data.type === "transcript") {
            setTranscript((t) => t + data.delta);
          } else if (data.type === "transcript_end") {
            setTranscript((t) => t + " ");
          }
        } catch {}
      };

      ws.onclose = () => {
        console.log('🔴 WebSocket closed');
        setStatus("Connection closed");
        stopRecording();
      };

      ws.onerror = (err) => {
        console.error('❌ WebSocket error:', err);
        setStatus("Connection error");
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
  }

  async function handleToggleRecording() {
    if (isStreaming) {
      console.log('⏹️ Stopping recording...');
      await stopRecording();
      
      if (transcript.trim()) {
        await submitAnswer();
      }
    } else {
      console.log('🎙️ Starting recording...');
      setTranscript("");
      setFeedback(null);
      
      try {
        const res = await fetch(
          `${API_BASE}/api/interviews/${interviewId}/rt/start`,
          { method: "POST" }
        );
        const data = await res.json();
        console.log('📥 RT start response:', data);
        setSessionId(data.sessionId);
        
        await startRecording(data.node_ws_url);
        setIsStreaming(true);
      } catch (e: any) {
        console.error('❌ Start recording error:', e);
        setStatus("Failed to start recording: " + e.message);
      }
    }
  }

  async function submitAnswer() {
    if (!transcript.trim()) {
      setStatus("No answer to submit");
      return;
    }

    setIsAnalyzing(true);
    setStatus("Analyzing your answer...");

    try {
      console.log('📤 Submitting answer...');
      const res = await fetch(
        `${API_BASE}/api/interviews/${interviewId}/rt/submit-answer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionId,
            transcript: transcript,
            question_index: currentQuestionIndex,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to submit answer");

      const data = await res.json();
      console.log('📥 Submit answer response:', data);
      const answerFeedback = data.feedback as Feedback;
      
      setFeedback(answerFeedback);
      setAnswers((prev) => [
        ...prev,
        {
          question: currentQuestion,
          answer: transcript,
          feedback: answerFeedback,
          words: wordCount,
        },
      ]);

      setStatus("Answer analyzed!");
    } catch (e: any) {
      console.error('❌ Submit answer error:', e);
      setStatus("Error analyzing answer: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  const handleNextQuestion = async () => {
    console.log('➡️ Next question button clicked');
    await loadNextQuestion();
  };

  const handleFinalize = async () => {
    try {
      console.log('🏁 Finalizing interview...');
      stopSpeech(); // Stop any ongoing speech
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

  useEffect(() => {
    return () => {
      stopRecording();
      stopSpeech(); // Clean up speech on unmount
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
          <h1 className="text-lg font-bold">AI Interview Practice</h1>
          <span className="text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {allQuestions.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Audio toggle button */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (audioEnabled) stopSpeech();
            }}
          >
            {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={() => router.push("/interview-setup")}>
            <Home className="mr-2 h-4 w-4" />
            Exit
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Side - Video & Controls */}
        <div className="w-2/3 p-4 flex flex-col gap-4 overflow-y-auto">
          {/* Question Card */}
          <Card className="p-4 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Current Question</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => currentQuestion && speakQuestion(currentQuestion)}
                  className="text-primary hover:text-primary/80 transition"
                  title="Replay question"
                >
                  <Volume2 size={16} />
                </button>
                <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-medium">
                  {currentQuestionIndex + 1}/{allQuestions.length}
                </span>
              </div>
            </div>
            <p className="text-lg font-semibold">{currentQuestion || "Loading..."}</p>
          </Card>

          {/* Video Section */}
          <Card className="flex-1 overflow-hidden flex flex-col min-h-[400px]">
            <div className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden">
              {/* Video Feed */}
              {showVideo && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}

              {/* Overlay */}
              <div className="absolute inset-0 flex flex-col justify-between p-4 bg-gradient-to-b from-black/40 via-transparent to-black/60">
                {/* Top Bar */}
                <div className="flex justify-between items-start">
                  <div className="bg-black/70 backdrop-blur-sm px-3 py-2 rounded-lg">
                    {isStreaming ? (
                      <div className="flex items-center gap-2 text-white text-sm">
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span className="font-medium">Recording</span>
                        <span className="text-white/70">• {formatTime(duration)}</span>
                      </div>
                    ) : (
                      <span className="text-white/70 text-sm">{status}</span>
                    )}
                  </div>

                  <button
                    onClick={() => setShowVideo(!showVideo)}
                    className="bg-black/70 backdrop-blur-sm p-2 rounded-lg text-white hover:bg-black/90 transition"
                  >
                    {showVideo ? <Video size={18} /> : <VideoOff size={18} />}
                  </button>
                </div>

                {/* Bottom Controls */}
                <div className="flex justify-center">
                  <button
                    onClick={handleToggleRecording}
                    disabled={isAnalyzing || interviewComplete}
                    className={`p-5 rounded-full text-white transition-all shadow-2xl hover:scale-110 active:scale-95 ${
                      isStreaming
                        ? "bg-red-500 hover:bg-red-600"
                        : "bg-green-500 hover:bg-green-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                  >
                    {isStreaming ? <MicOff size={28} /> : <Mic size={28} />}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Action Button */}
          {feedback && !interviewComplete && (
            <Button onClick={handleNextQuestion} size="lg" className="w-full shrink-0">
              Next Question
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>
          )}
          {interviewComplete && (
            <Button onClick={handleFinalize} size="lg" className="w-full shrink-0">
              View Final Report
            </Button>
          )}
        </div>

        {/* Right Side - Transcription & Feedback */}
        <div className="w-1/3 border-l border-border flex flex-col overflow-hidden">
          {/* Real-Time Transcription */}
          <div className="flex-1 flex flex-col overflow-hidden p-4 pb-0">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Real-Time Transcription
            </h3>
            <Card className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                {transcript ? (
                  <div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                      {transcript}
                    </p>
                    <div ref={transcriptEndRef} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic text-center mt-8">
                    {isStreaming ? "Listening... start speaking" : "Click the microphone to begin"}
                  </p>
                )}
              </div>
              
              {/* Transcript Footer */}
              {transcript && (
                <div className="border-t border-border p-3 bg-muted/50">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{wordCount} words</span>
                    {isStreaming && <span>{formatTime(duration)}</span>}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Feedback Section */}
          <div className="p-4 pt-0 overflow-y-auto">
            {feedback ? (
              <Card className="p-4 bg-accent/5 border-accent/20 mt-4">
                <h4 className="font-semibold mb-3 text-sm">AI Feedback</h4>
                <div className="space-y-2 mb-3">
                  {[
                    { label: "Clarity", value: feedback.clarity },
                    { label: "Confidence", value: feedback.confidence },
                    { label: "Structure", value: feedback.structure },
                    { label: "Relevance", value: feedback.relevance },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-center">
                      <span className="text-xs">{item.label}</span>
                      <span className={`font-bold text-sm ${getScoreColor(item.value)}`}>
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">{feedback.summary}</p>
                  {feedback.tips && feedback.tips.length > 0 && (
                    <ul className="text-xs space-y-1">
                      {feedback.tips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-accent">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            ) : (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                <p>Feedback will appear here after you submit your answer</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}