"use client";
import { useEffect, useRef, useState } from "react";

export default function ShadowInterviewPage() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Ready to start");
  const [currentQuestion, setCurrentQuestion] = useState("Tell me about yourself.");
  
  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

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

        // Send sample rate config
        try {
          ws.send(JSON.stringify({ type: "config", sampleRate: ctx.sampleRate }));
          console.log("Sent sample rate:", ctx.sampleRate);
        } catch (e) {
          console.error("Failed to send config:", e);
        }

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

        setStatus("Connected! Speak now...");
      };

      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data as any);
          console.log("Received:", data);
          
          if (data.type === "transcript") {
            setTranscript((t) => t + data.delta);
            setStatus("Transcribing...");
          } else if (data.type === "transcript_end") {
            setTranscript((t) => t + "\n");
            setStatus("Waiting for speech...");
          }
        } catch (e) {
          console.error("Parse error:", e);
        }
      };

      ws.onclose = () => {
        setStatus("Disconnected");
        stop();
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setStatus("Connection error");
        stop();
      };
    } catch (err) {
      console.error("Start error:", err);
      setStatus("Error: " + (err as Error).message);
      stop();
    }
  }

  async function stop() {
    setIsStreaming(false);
    setStatus("Stopped");
    
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
      await stop();
    } else {
      setTranscript("");
      await start("ws://127.0.0.1:8081");
      setIsStreaming(true);
    }
  }

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between bg-white p-6 rounded-lg shadow">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Realtime Interview</h1>
            <p className="text-sm text-gray-600 mt-1">{status}</p>
          </div>
          <button
            onClick={handleToggle}
            className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
              isStreaming 
                ? "bg-red-600 hover:bg-red-700" 
                : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {isStreaming ? "⏹ Stop Recording" : "🎤 Start Recording"}
          </button>
        </header>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Current Question</h2>
          <p className="text-gray-700 text-lg">{currentQuestion}</p>
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Live Transcript</h2>
          <div className="p-4 border-2 border-gray-200 rounded-lg min-h-[200px] bg-gray-50">
            {transcript ? (
              <p className="whitespace-pre-wrap text-gray-800">{transcript}</p>
            ) : (
              <p className="text-gray-400 italic">
                {isStreaming ? "Listening... start speaking" : "Click 'Start Recording' to begin"}
              </p>
            )}
          </div>
          {transcript && (
            <div className="mt-3 text-sm text-gray-600">
              {transcript.split(/\s+/).length} words
            </div>
          )}
        </section>

        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-3 text-gray-900">Saved Answers</h2>
          <p className="text-gray-500">No answers saved yet. Stop recording to save your answer.</p>
        </section>

        {/* Debug info */}
        <section className="bg-gray-100 p-4 rounded text-xs text-gray-600">
          <p><strong>Debug:</strong></p>
          <p>Recording: {isStreaming ? "Yes" : "No"}</p>
          <p>WebSocket: {wsRef.current?.readyState === 1 ? "Connected" : "Disconnected"}</p>
          <p>Audio Context: {audioCtxRef.current?.state || "Not initialized"}</p>
        </section>
      </div>
    </div>
  );
}