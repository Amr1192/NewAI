"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, Play, Square } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type Feedback = { note: string; fillerWords: number; pace: string };

export default function ShadowInterviewPage() {
  // UI state
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);


  const [interviewId, setInterviewId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [currentQuestion, setCurrentQuestion] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [transcript, setTranscript] = useState("");

  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [overall, setOverall] = useState<any>(null);

  // Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopFlagRef = useRef(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Utils
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  function resetUi() {
    setTranscript("");
    setFeedback([]);
    setAnswers([]);
    setOverall(null);
  }

  function hardStopMedia() {
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // ----- SSE -----
  function startEvents(id: number, sid: string) {
    try {
      eventSourceRef.current?.close();
    } catch {}
    const es = new EventSource(`${API_BASE}/api/interviews/${id}/rt/stream/${sid}`);
    eventSourceRef.current = es;

    es.onopen = () => console.log("✅ SSE connected:", sid);

    es.addEventListener("partial", (e) => {
      const d = JSON.parse(e.data);
      if (d.text) setTranscript((t) => `${t} ${d.text}`.trim());
      if (d.analysis) setFeedback((f) => [...f, d.analysis]);
    });

    es.addEventListener("final", (e) => {
      const d = JSON.parse(e.data);
      setAnswers((a) => [...a, d]);
      setTranscript("");
      setFeedback([]);
    });

    es.onerror = () => {
      console.warn("SSE dropped — reconnecting…");
      setTimeout(() => startEvents(id, sid), 1200);
    };
  }

  // ----- Recording -----
  async function startRecording(id: number, sid: string) {
    console.log("🎬 Start recording:", id, sid);
    stopFlagRef.current = false;
    setIsRecording(true);

    // (Re)acquire based on current UI toggles
    const baseStream = await navigator.mediaDevices.getUserMedia({
      audio: isMicOn,
      video: isVideoOn,
    });
    mediaStreamRef.current = baseStream;
    if (videoRef.current && isVideoOn) videoRef.current.srcObject = baseStream;

    // Chunk loop – take a fresh snapshot of *live* audio tracks each cycle
    while (!stopFlagRef.current) {
      const liveAudio =
        mediaStreamRef.current?.getAudioTracks().filter((t) => t.readyState === "live") ?? [];

      // If no live audio (mic off), wait a slice and continue
      if (liveAudio.length === 0) {
        await wait(400); // small idle tick
        continue;
      }

      const audioOnly = new MediaStream(liveAudio);
      const blob = await recordChunk(audioOnly).catch(() => null);

      if (stopFlagRef.current || !blob || blob.size < 3000) {
        if (stopFlagRef.current) break;
        continue;
      }

      const fd = new FormData();
      fd.append("sessionId", sid);
      fd.append("file", blob, `chunk_${Date.now()}.webm`);

      try {
        const res = await fetch(`${API_BASE}/api/interviews/${id}/rt/chunk`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          console.warn("❌ Chunk upload failed:", await res.text());
        } else {
          console.log("☑️ Uploaded chunk");
        }
      } catch (err) {
        console.error("❌ Upload error:", err);
      }
    }

    // Cleanup local devices
    hardStopMedia();
    console.log("🛑 Recording loop ended.");
  }

  function recordChunk(stream: MediaStream): Promise<Blob> {
    return new Promise((resolve) => {
      let mr: MediaRecorder;
      try {
        mr = new MediaRecorder(stream, {
          mimeType: "audio/webm;codecs=opus",
          audioBitsPerSecond: 128000,
        });
      } catch {
        // recorder couldn't start (track ended mid-cycle)
        return resolve(new Blob());
      }

      const chunks: BlobPart[] = [];
      mr.ondataavailable = (e) => {
        if (e.data?.size > 0) chunks.push(e.data);
      };
      mr.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));

      try {
        mr.start();
      } catch {
        return resolve(new Blob());
      }
      setTimeout(() => {
        if (mr.state === "recording") mr.stop();
      }, 6000);
    });
  }

  async function stopRecording() {
    console.log("⏹ Stopping…");
    stopFlagRef.current = true;
    setIsRecording(false);

    // local media
    hardStopMedia();

    // close SSE now; we'll reopen if needed
    try {
      eventSourceRef.current?.close();
    } catch {}

    // server-side session
    if (interviewId && sessionId) {
      try {
        await fetch(`${API_BASE}/api/interviews/${interviewId}/rt/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      } catch (e) {
        console.warn("stop failed:", e);
      }
    }
  }

  // ----- Track helpers (hard mic/cam toggle) -----
  function stopAndRemove(kind: "audio" | "video") {
    const s = mediaStreamRef.current;
    if (!s) return;
    const tracks = kind === "audio" ? s.getAudioTracks() : s.getVideoTracks();
    tracks.forEach((t) => {
      try {
        t.stop();
      } catch {}
      try {
        s.removeTrack(t);
      } catch {}
    });
    if (kind === "video" && videoRef.current) videoRef.current.srcObject = null;
  }

  async function addTrack(kind: "audio" | "video") {
    const constraints = kind === "audio" ? { audio: true, video: false } : { audio: false, video: true };
    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = kind === "audio" ? newStream.getAudioTracks()[0] : newStream.getVideoTracks()[0];
    if (!mediaStreamRef.current) mediaStreamRef.current = new MediaStream();
    mediaStreamRef.current.addTrack(track);
    if (kind === "video" && videoRef.current) videoRef.current.srcObject = mediaStreamRef.current;
  }

  async function toggleMic() {
    if (isMicOn) {
      stopAndRemove("audio");
      setIsMicOn(false);
      console.log("🎙️ Mic OFF");
    } else {
      try {
        await addTrack("audio");
        setIsMicOn(true);
        console.log("🎙️ Mic ON");
      } catch (e) {
        console.warn("Could not enable mic:", e);
      }
    }
  }

  async function toggleVideo() {
    if (isVideoOn) {
      stopAndRemove("video");
      setIsVideoOn(false);
      console.log("📷 Camera OFF");
    } else {
      try {
        await addTrack("video");
        setIsVideoOn(true);
        console.log("📷 Camera ON");
      } catch (e) {
        console.warn("Could not enable camera:", e);
      }
    }
  }

  // ----- Flow -----
  async function startInterview() {
    resetUi();

    // create interview
    const startRes = await fetch(`${API_BASE}/api/interviews/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: 1 }),
    });
    const startData = await startRes.json();
    setInterviewId(startData.id);

    // first question
    const qRes = await fetch(`${API_BASE}/api/interviews/${startData.id}/next-question`);
    const qData = await qRes.json();
    if (qData.done) throw new Error("No questions found");
    setCurrentQuestion(qData.question);
    setQuestionIndex(qData.index);
    setTotalQuestions(qData.total);

    // one RT session for this question
    const sRes = await fetch(`${API_BASE}/api/interviews/${startData.id}/rt/start`, { method: "POST" });
    const { sessionId: sid } = await sRes.json();
    setSessionId(sid);

    // open SSE first, then record
    startEvents(startData.id, sid);
    await wait(200);
    startRecording(startData.id, sid);
  }

 async function nextQuestion() {
  if (!interviewId || !sessionId) return;

  setIsTransitioning(true); // 🧩 lock UI text

  await stopRecording();
  await wait(600); // small cooldown

  // fetch next question
  const qRes = await fetch(`${API_BASE}/api/interviews/${interviewId}/next-question`);
  const qData = await qRes.json();

  if (qData.done) {
    const finRes = await fetch(`${API_BASE}/api/interviews/${interviewId}/finalize`, { method: "POST" });
    const finData = await finRes.json();
    setOverall(finData.summary);
    setIsRecording(false);
    setIsTransitioning(false);
    return;
  }

  setCurrentQuestion(qData.question);
  setQuestionIndex(qData.index);
  setTranscript("");
  setFeedback([]);

  // fresh RT session
  const sRes = await fetch(`${API_BASE}/api/interviews/${interviewId}/rt/start`, { method: "POST" });
  const { sessionId: newSid } = await sRes.json();
  setSessionId(newSid);

  startEvents(interviewId, newSid);
  await wait(150);
  await startRecording(interviewId, newSid);

  setIsTransitioning(false); // 🧩 release lock
  console.log("🎙️ Ready for next question:", qData.question);
}


  useEffect(() => {
    return () => {
      try {
        eventSourceRef.current?.close();
      } catch {}
      hardStopMedia();
    };
  }, []);

  async function stopAndResetInterview() {
  console.log("🛑 Terminating interview...");
  await stopRecording();
  resetUi();
  setInterviewId(null);
  setSessionId(null);
  setCurrentQuestion("");
  setQuestionIndex(0);
  setTotalQuestions(0);
  setIsRecording(false);
  console.log("✅ Interview reset — ready to start again.");
}


  // ----- UI -----
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-lg font-bold">AI Interview Practice</h1>
       <Button
  onClick={isRecording ? nextQuestion : startInterview}
  className={
    isRecording
      ? "bg-blue-600 hover:bg-blue-700"
      : "bg-blue-300 hover:bg-blue-400"
  }
>
  {isRecording || isTransitioning ? "Next Question" : "Next Question"}
</Button>

      </header>

      <main className="flex flex-1 gap-6 p-6">
        <div className="flex-1 flex flex-col">
          <Card className="p-4 mb-4">
            <h2 className="font-semibold text-lg">Question {questionIndex + 1}</h2>
            <p className="text-sm text-muted-foreground">{currentQuestion || "—"}</p>
          </Card>

          <div className="bg-black/90 flex-1 rounded-xl relative overflow-hidden grid place-items-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!isVideoOn ? "hidden" : ""}`}
            />
            {!isVideoOn && <div className="text-white/60">Camera Off</div>}

            <div className="absolute bottom-6 flex items-center gap-6">
              <button onClick={toggleMic} className="bg-white/20 hover:bg-white/30 p-3 rounded-full text-white">
                {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
              </button>

              <button
                onClick={isRecording ? stopAndResetInterview : startInterview}
                className={`p-4 rounded-full text-white ${
                  isRecording ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isRecording ? <Square size={22} /> : <Play size={22} />}
              </button>

              <button onClick={toggleVideo} className="bg-white/20 hover:bg-white/30 p-3 rounded-full text-white">
                {isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
              </button>
            </div>
          </div>

          <Card className="mt-4 p-4">
            <h3 className="font-semibold mb-2">Transcript</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {transcript || (isRecording ? "Listening…" : "—")}
            </p>
          </Card>
        </div>

        <aside className="w-[380px] flex flex-col gap-4">
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Real-Time Feedback</h3>
            <div className="space-y-2 max-h-[40vh] overflow-auto">
              {feedback.length > 0 ? (
                feedback.map((p, i) => (
                  <div key={i} className="text-sm border-b pb-2">
                    <div><b>Note:</b> {p.note ?? "—"}</div>
                    <div><b>Filler:</b> {p.fillerWords ?? 0} | <b>Pace:</b> {p.pace ?? "good"}</div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-2">Answers So Far</h3>
            <div className="space-y-3 max-h-[35vh] overflow-auto">
              {answers.length > 0 ? (
                answers.map((a, i) => (
                  <div key={i} className="text-xs border rounded p-2">
                    <div className="font-semibold">Q{i + 1}</div>
                    <div className="mt-1 text-muted-foreground">{a.transcript || "No text"}</div>
                    <pre className="mt-2 bg-muted p-2 rounded overflow-auto text-xs">
                      {JSON.stringify(a.analysis, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">—</div>
              )}
            </div>
          </Card>

          {overall && (
            <Card className="p-4">
              <h3 className="font-semibold mb-2">Final Summary</h3>
              <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(overall, null, 2)}</pre>
              <Button className="mt-3 w-full" onClick={() => (window.location.href = `/interviews/${interviewId}/report`)}>
                View Full Report
              </Button>
            </Card>
          )}
        </aside>
      </main>
    </div>
  );
}
