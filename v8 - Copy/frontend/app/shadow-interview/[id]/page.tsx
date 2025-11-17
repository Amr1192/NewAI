"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic, MicOff, ChevronRight, Home, Video, VideoOff, Volume2, VolumeX, Play, Sparkles, AlertTriangle, Check, X, BarChart3, Loader2 } from "lucide-react";
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
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isTTSMuted, setIsTTSMuted] = useState(false); // Track auto-mute during TTS
  const [questionsSource, setQuestionsSource] = useState<'ai' | 'fallback' | 'unknown'>('unknown');
  const [showFeedbackPopup, setShowFeedbackPopup] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const speechFinishedRef = useRef<boolean>(false);
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
    if (currentQuestion && currentQuestion !== "" && audioEnabled && hasStarted && !isLoadingNext) {
      speechFinishedRef.current = false;
      speakQuestion(currentQuestion);
    }
  }, [currentQuestion, audioEnabled, hasStarted, isLoadingNext]);

  useEffect(() => {
    if (mediaStreamRef.current) {
      const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMicMuted;
        console.log('🎤 Mic', isMicMuted ? 'MUTED' : 'UNMUTED');
      }
    }
  }, [isMicMuted]);

  const speakQuestion = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // ✅ MUTE microphone while question is being spoken
        utterance.onstart = () => {
          console.log('🔇 Muting mic during TTS');
          setIsTTSMuted(true);
          if (mediaStreamRef.current) {
            const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = false;
            }
          }
        };
        
        utterance.onend = () => {
          console.log('✅ TTS finished');
          speechFinishedRef.current = true;
          setIsTTSMuted(false);
          
          // ✅ UNMUTE microphone after question is spoken (only if user hasn't manually muted)
          if (!isMicMuted && mediaStreamRef.current) {
            console.log('🔊 Unmuting mic after TTS');
            const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = true;
            }
          }
        };
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.name.includes('Female')) || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        
        console.log('🔊 Speaking question...');
        window.speechSynthesis.speak(utterance);
      }, 100);
    }
  };

  const stopSpeech = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      speechFinishedRef.current = true;
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
      
      setStatus("Click 'Start Interview' to begin");
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
      
      // ✅ CRITICAL FIX: Update state in correct order
      setCurrentQuestion(data.question);
      setCurrentQuestionIndex(data.index);
      
      return true;
      
    } catch (e: any) {
      console.error('❌ Error loading next question:', e);
      setStatus("Error loading next question: " + e.message);
      return false;
    }
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

          if (ab && ws.readyState === WebSocket.OPEN && !isMicMuted) {
            ws.send(ab);
          }
        };

        setStatus("Recording... speak your answer");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as any);

          if (data.type === "transcript") {
            setTranscript((t) => t + data.delta);
            console.log('🎤 Real-time:', data.delta);
          } else if (data.type === "transcript_end") {
            setTranscript((t) => t + " ");
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

  // ✅ COMPLETELY REWRITTEN: Clean separation of concerns
  async function handleStartOrNext() {
    if (isProcessingRef.current || isLoadingNext || isAnalyzing) {
      console.log('⏳ Already processing, ignoring click');
      return;
    }

    isProcessingRef.current = true;

    try {
      if (!hasStarted) {
        // === SCENARIO 1: START INTERVIEW ===
        console.log('🎬 SCENARIO 1: Starting interview for first time');
        await handleStartInterview();
        
      } else if (!isSubmitted) {
        // === SCENARIO 2: SUBMIT CURRENT ANSWER ===
        console.log('📤 SCENARIO 2: Submitting current answer');
        await handleSubmitAnswer();
        
      } else {
        // === SCENARIO 3: MOVE TO NEXT QUESTION ===
        console.log('➡️ SCENARIO 3: Moving to next question');
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
    setStatus("Listening to question...");
    
    // Wait for TTS to finish speaking the first question
    await waitForTTS();
    
    // Start recording
    console.log('🎙️ Starting recording...');
    await startRecordingSession();
  }

  async function handleSubmitAnswer() {
    if (!transcript.trim()) {
      setStatus("Please record an answer first");
      return;
    }

    // Stop recording
    if (isStreaming) {
      await stopRecording();
    }
    
    // Submit the answer and get feedback
    await submitAnswer();
    setIsSubmitted(true);
  }

  async function handleNextQuestion() {
    setIsLoadingNext(true);
    setShowFeedbackPopup(false);
    setStatus("Loading next question...");
    
    // Stop any ongoing recording
    if (isStreaming) {
      await stopRecording();
    }
    
    // ✅ CRITICAL: Clear current answer state BEFORE loading next question
    setTranscript("");
    setFeedback(null);
    setIsSubmitted(false);
    setWordCount(0);
    
    // Load next question from API
    const success = await loadNextQuestion();
    
    if (!success) {
      // Interview complete or error
      setIsLoadingNext(false);
      return;
    }
    
    // Wait for TTS to finish speaking the new question
    await waitForTTS();
    
    // Start recording for the new question
    console.log('🎙️ Starting recording for new question...');
    await startRecordingSession();
    
    setIsLoadingNext(false);
  }

  async function waitForTTS() {
    console.log('🔊 Waiting for TTS to finish...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (!speechFinishedRef.current) {
      for (let i = 0; i < 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (speechFinishedRef.current) break;
      }
    }
    console.log('✅ TTS complete');
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
    if (!transcript.trim()) {
      return;
    }

    setIsAnalyzing(true);
    setStatus("Analyzing your answer...");

    try {
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

      setStatus("Answer analyzed! Click 'Next Question' to continue");
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
      stopSpeech();
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
    if (transcript.trim() && !feedback) {
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
      stopSpeech();
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
          <h1 className="text-lg font-bold">AI Interview Practice</h1>
          <span className="text-sm text-muted-foreground">
            Question {currentQuestionIndex + 1} of {allQuestions.length}
          </span>
          
          {questionsSource === 'ai' && (
            <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded">
              <Sparkles size={12} />
              AI Questions
            </span>
          )}
          {questionsSource === 'fallback' && (
            <span className="flex items-center gap-1 text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded">
              <AlertTriangle size={12} />
              Fallback Questions
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleExit} disabled={isLoadingNext}>
          <Home className="mr-2 h-4 w-4" />
          Exit & View Report
        </Button>
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
                  disabled={isLoadingNext}
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
                        <span className="font-medium">Recording</span>
                        <span className="text-white/70">• {formatTime(duration)}</span>
                        {isTTSMuted && <span className="text-yellow-400">• Listening to question...</span>}
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
                </div>
              </div>
            </div>
          </Card>

          {/* Control Buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleStartOrNext}
              disabled={isAnalyzing || interviewComplete || isLoadingNext}
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
                  Start Interview
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

            <Button
              variant={audioEnabled ? "default" : "outline"}
              size="lg"
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (audioEnabled) stopSpeech();
              }}
              disabled={isLoadingNext}
              title={audioEnabled ? "Mute Question Audio" : "Unmute Question Audio"}
            >
              {audioEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Right Side - Full Transcription */}
        <div className="w-1/3 border-l border-border flex flex-col overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Real-Time Transcription
              </h3>
              
              {/* Feedback Button */}
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
                    {hasStarted ? (
                      isTTSMuted ? "🔊 Listening to question..." : 
                      isMicMuted ? "Microphone muted" : 
                      isLoadingNext ? "Loading next question..." : 
                      "Listening... start speaking"
                    ) : "Click 'Start Interview' to begin"}
                  </p>
                )}
              </div>
              
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

          {/* FLOATING FEEDBACK POPUP */}
          {feedback && showFeedbackPopup && !isLoadingNext && (
            <div className="absolute bottom-4 right-4 w-80 z-50 animate-in slide-in-from-bottom-4">
              <Card className="bg-white dark:bg-gray-900 border-2 border-blue-500 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="font-semibold text-sm">Answer Feedback</span>
                  </div>
                  <button
                    onClick={() => setShowFeedbackPopup(false)}
                    className="text-muted-foreground hover:text-foreground transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Scores */}
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

                {/* Summary */}
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