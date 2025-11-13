"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, CheckCircle, AlertCircle, Play, X } from "lucide-react";

export default function ShadowInterviewPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Ready to start");
  const [currentQuestion, setCurrentQuestion] = useState("Tell me about yourself.");
  const [wordCount, setWordCount] = useState(0);
  const [duration, setDuration] = useState(0);
  const [savedAnswers, setSavedAnswers] = useState<Array<{question: string, answer: string, words: number}>>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("behavioral");
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const categories = [
    { id: "behavioral", label: "Behavioral", icon: "😊" },
    { id: "technical", label: "Technical", icon: "💻" },
    { id: "situational", label: "Situational", icon: "❓" },
  ];

  const commonQuestions = [
    "Tell me about yourself.",
    "What are your greatest strengths?",
    "Describe a challenging situation and how you handled it.",
  ];

  useEffect(() => {
    if (transcript) {
      setWordCount(transcript.trim().split(/\s+/).filter(w => w.length > 0).length);
    }
  }, [transcript]);

  useEffect(() => {
    if (isStreaming) {
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreaming]);

  async function start(url: string) {
    try {
      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

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

        setStatus("Recording");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as any);
          
          if (data.type === "transcript") {
            setTranscript((t) => t + data.delta);
          } else if (data.type === "transcript_end") {
            setTranscript((t) => t + " ");
          }
        } catch {}
      };

      ws.onclose = () => {
        setStatus("Disconnected");
        stop();
      };

      ws.onerror = () => {
        setStatus("Connection error");
        stop();
      };
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
      stop();
    }
  }

  async function stop() {
    setIsStreaming(false);
    setStatus("Ready to start");
    
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
  }

  async function handleToggle() {
    if (isStreaming) {
      if (transcript.trim()) {
        setSavedAnswers(prev => [...prev, {
          question: currentQuestion,
          answer: transcript.trim(),
          words: wordCount
        }]);
      }
      await stop();
      setTranscript("");
      setWordCount(0);
    } else {
      setTranscript("");
      await start("ws://127.0.0.1:8081");
      setIsStreaming(true);
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="text-primary size-7">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_6_319)">
                <path
                  d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
                  fill="currentColor"
                ></path>
              </g>
              <defs>
                <clipPath id="clip0_6_319">
                  <rect fill="white" height="48" width="48"></rect>
                </clipPath>
              </defs>
            </svg>
          </div>
          <h1 className="text-lg font-bold tracking-tight">AI Interview Practice</h1>
        </div>
        <div className="flex items-center gap-6">
          <a href="/create-cv" className="text-sm font-medium text-muted-foreground hover:text-primary transition">
            CV Builder
          </a>
          <a href="/job-search" className="text-sm font-medium text-muted-foreground hover:text-primary transition">
            Job Search
          </a>
          <a href="/shadow-interviews" className="text-sm font-medium text-muted-foreground hover:text-primary transition">
            Shadow Interviews
          </a>
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium">My Profile</button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500"></div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-1/4 min-w-[300px] border-r border-border bg-card p-6 flex flex-col justify-between">
          <div>
            {/* User Info */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-500"></div>
              <div>
                <h2 className="text-base font-semibold">John Doe</h2>
                <p className="text-sm text-muted-foreground">Software Engineer</p>
              </div>
            </div>

            {/* Categories */}
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3 tracking-wider">
              Question Categories
            </h3>
            <div className="flex flex-col gap-2 mb-8">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                    selectedCategory === cat.id ? "bg-accent/10 text-accent" : "hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <p className="text-sm font-medium">{cat.label}</p>
                </button>
              ))}
            </div>

            {/* Common Questions */}
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 tracking-wider">Common Questions</h3>
            <div className="space-y-2">
              {commonQuestions.map((question, idx) => (
                <div key={idx} className="flex items-center justify-between gap-4 bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="text-accent flex items-center justify-center rounded-lg bg-accent/10 shrink-0 size-8">
                      <Play size={20} />
                    </div>
                    <p className="text-sm font-normal flex-1 truncate">{question}</p>
                  </div>
                  <button className="text-sm font-medium text-accent hover:underline">Start</button>
                </div>
              ))}
            </div>
          </div>

          <button className="w-full bg-accent text-white px-4 py-2 rounded-lg font-medium">Upgrade to Premium</button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 grid grid-cols-3 gap-8">
          {/* Video/Recording Section */}
          <div className="col-span-2 flex flex-col">
            <div className="bg-gray-900 rounded-xl flex-1 flex flex-col justify-center items-center relative overflow-hidden">
              {/* Progress Bar */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gray-700">
                <div className="h-full bg-accent" style={{ width: isStreaming ? `${Math.min((duration / 120) * 100, 100)}%` : "0%" }}></div>
              </div>

              {/* Status Display */}
              <div className="text-center z-10">
                <div className="mb-4">
                  {isStreaming ? (
                    <div className="flex items-center justify-center gap-2 text-white">
                      <span className="flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                      </span>
                      <span className="text-sm font-medium">Recording</span>
                    </div>
                  ) : (
                    <MicOff className="w-16 h-16 text-gray-500 mx-auto" />
                  )}
                </div>
                <p className="text-white/70 text-sm">{status}</p>
                {isStreaming && (
                  <div className="mt-2 text-white/50 text-xs">
                    {formatTime(duration)} • {wordCount} words
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="absolute bottom-6 flex items-center gap-6">
                <button
                  onClick={handleToggle}
                  className={`p-4 rounded-full text-white transition ${
                    isStreaming ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                  }`}
                >
                  {isStreaming ? <Square size={24} /> : <Mic size={24} />}
                </button>
              </div>

              {/* Top Right Info */}
              {isStreaming && (
                <div className="absolute top-6 right-6 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-lg text-white text-sm">
                  WebSocket: {wsRef.current?.readyState === 1 ? "Connected" : "Disconnected"}
                </div>
              )}
            </div>

            {/* Question Display */}
            <div className="mt-4 bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-lg mb-2">Question:</h3>
              <p className="text-muted-foreground">{currentQuestion}</p>
            </div>

            {/* Transcript Display */}
            <div className="mt-4 bg-card border border-border rounded-xl p-4">
              <h3 className="font-semibold text-lg mb-2">Your Response:</h3>
              <div className="min-h-[120px] max-h-[200px] overflow-y-auto">
                {transcript ? (
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-muted-foreground italic text-sm">
                    {isStreaming ? "Listening... start speaking" : "Click the microphone to start recording"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Feedback Panel */}
          <aside className="bg-card border border-border rounded-xl p-6 flex flex-col">
            <h3 className="text-lg font-bold mb-4">Real-Time Feedback</h3>
            <div className="space-y-5 flex-1">
              {/* Word Count Metric */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium text-muted-foreground">Word Count</p>
                  <p className="text-sm font-bold text-foreground">{wordCount}</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-blue-500"
                    style={{ width: `${Math.min((wordCount / 150) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Duration Metric */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium text-muted-foreground">Duration</p>
                  <p className="text-sm font-bold text-foreground">{formatTime(duration)}</p>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-500"
                    style={{ width: `${Math.min((duration / 120) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Status Indicators */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Status</p>
                <div className="flex items-center gap-2 text-sm mb-2">
                  <CheckCircle size={16} className={isStreaming ? "text-green-500" : "text-gray-400"} />
                  <span className="text-muted-foreground">Recording Active</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle size={16} className={wsRef.current?.readyState === 1 ? "text-green-500" : "text-gray-400"} />
                  <span className="text-muted-foreground">Connection Status</span>
                </div>
              </div>

              {/* Saved Answers */}
              {savedAnswers.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Completed Answers</p>
                  <div className="space-y-2">
                    {savedAnswers.slice(-3).map((answer, idx) => (
                      <div key={idx} className="bg-muted p-2 rounded text-xs">
                        <p className="font-medium truncate">{answer.question}</p>
                        <p className="text-muted-foreground">{answer.words} words</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button 
                onClick={() => setShowModal(true)} 
                className="w-full mt-auto border border-border bg-background hover:bg-muted px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                View Full Report
              </button>
            </div>
          </aside>
        </main>
      </div>

      {/* Feedback Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-6 border-b border-border flex justify-between items-center sticky top-0 bg-card">
              <h3 className="text-xl font-bold">Interview Summary</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground transition"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Overall Performance */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Performance Summary</h4>
                  <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-lg">
                    <p className="text-green-800 dark:text-green-300 font-semibold">
                      Interview completed successfully! Total answers: {savedAnswers.length}
                    </p>
                  </div>
                </div>

                {/* Statistics */}
                <div>
                  <h4 className="text-lg font-semibold mb-3">Statistics</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Words:</span>
                      <span className="font-semibold">{savedAnswers.reduce((sum, a) => sum + a.words, 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Answers Saved:</span>
                      <span className="font-semibold">{savedAnswers.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saved Answers */}
              <div>
                <h4 className="text-lg font-semibold mb-3">Your Answers</h4>
                <div className="space-y-4">
                  {savedAnswers.map((answer, idx) => (
                    <div key={idx} className="bg-muted p-4 rounded-lg">
                      <p className="font-semibold mb-2">Q{idx + 1}: {answer.question}</p>
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-3">{answer.answer}</p>
                      <p className="text-xs text-muted-foreground">{answer.words} words</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-muted border-t border-border flex justify-end gap-3 sticky bottom-0">
              <button 
                onClick={() => setShowModal(false)}
                className="border border-border bg-background hover:bg-card px-4 py-2 rounded-lg text-sm font-medium transition"
              >
                Close
              </button>
              <button className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90 transition">
                Practice Again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}