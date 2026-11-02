import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "paused" | "stopped" | "denied" | "unsupported" | "error";

const PREFERRED_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return PREFERRED_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
}

export interface Recording {
  blob: Blob;
  url: string;
  seconds: number;
}

/** Browser recording with explicit handling of denial, unsupported formats, empty recordings and cancellation. */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>(recordingSupported() ? "idle" : "unsupported");
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const cancelled = useRef(false);
  const pausedAt = useRef<number | null>(null);
  const finalized = useRef(false);
  const finalizeRef = useRef<(() => void) | null>(null);
  const watchdog = useRef<number | null>(null);
  const pausedTotal = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const elapsedNow = () => (performance.now() - startedAt.current - pausedTotal.current - (pausedAt.current != null ? performance.now() - pausedAt.current : 0)) / 1000;

  const cleanupStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    if (watchdog.current) window.clearTimeout(watchdog.current);
    watchdog.current = null;
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setAnalyser(null);
  };

  useEffect(
    () => () => {
      cancelled.current = true;
      try {
        rec.current?.stop();
      } catch {
        /* already stopped */
      }
      cleanupStream();
    },
    [],
  );

  useEffect(() => () => {
    if (recording) URL.revokeObjectURL(recording.url);
  }, [recording]);

  const start = useCallback(async () => {
    if (!recordingSupported()) {
      setState("unsupported");
      return;
    }
    setError(null);
    setRecording(null);
    setState("requesting");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      const name = (err as Error).name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was blocked. You can allow it in your browser's site settings, or type your answer instead."
          : name === "NotFoundError"
            ? "No microphone was found. You can type your answer instead."
            : "The microphone couldn't be started. You can type your answer instead.",
      );
      return;
    }
    const mimeType = pickMimeType();
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined);
    } catch {
      cleanupStream();
      setState("unsupported");
      setError("This browser can't record audio in a supported format. You can type your answer instead.");
      return;
    }
    chunks.current = [];
    cancelled.current = false;
    finalized.current = false;
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.current.push(e.data);
    };
    const finalize = () => {
      if (finalized.current) return;
      finalized.current = true;
      if (watchdog.current) window.clearTimeout(watchdog.current);
      const seconds = elapsedNow();
      cleanupStream();
      if (cancelled.current) {
        setState("idle");
        return;
      }
      const blob = new Blob(chunks.current, { type: mr.mimeType || mimeType || "audio/webm" });
      if (blob.size < 1000 || seconds < 1) {
        setState("error");
        setError("That recording was empty or too short. Try again, or type your answer.");
        return;
      }
      setRecording({ blob, url: URL.createObjectURL(blob), seconds });
      setState("stopped");
    };
    finalizeRef.current = finalize;
    mr.onstop = finalize;
    mr.onerror = () => finalize();
    // If the microphone is taken away mid-recording (another app, or the OS), finish with what we have.
    for (const track of stream.current.getAudioTracks()) track.onended = () => finalize();
    rec.current = mr;
    startedAt.current = performance.now();
    pausedAt.current = null;
    pausedTotal.current = 0;
    setElapsed(0);
    mr.start(1000);
    timer.current = window.setInterval(() => setElapsed(elapsedNow()), 250);
    // Live level meter for the waveform (optional; recording works without it).
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        const src = ctx.createMediaStreamSource(stream.current);
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        an.smoothingTimeConstant = 0.6;
        src.connect(an);
        audioCtx.current = ctx;
        setAnalyser(an);
      }
    } catch {
      /* no meter */
    }
    setState("recording");
  }, []);

  const pause = useCallback(() => {
    const mr = rec.current;
    if (!mr || mr.state !== "recording" || typeof mr.pause !== "function") return;
    mr.pause();
    pausedAt.current = performance.now();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    const mr = rec.current;
    if (!mr || mr.state !== "paused") return;
    mr.resume();
    if (pausedAt.current != null) pausedTotal.current += performance.now() - pausedAt.current;
    pausedAt.current = null;
    setState("recording");
  }, []);

  /**
   * Stop and finish the recording. Never leaves the UI stuck on "Recording": if the
   * recorder has already gone inactive, throws, or never fires onstop, we finish from
   * the chunks collected so far.
   */
  const stop = useCallback(() => {
    const mr = rec.current;
    if (!mr) return;
    if (mr.state === "inactive") {
      finalizeRef.current?.();
      return;
    }
    try {
      if (mr.state === "paused" && typeof mr.resume === "function") mr.resume();
      if (typeof mr.requestData === "function") mr.requestData();
      mr.stop();
    } catch {
      // requestData() may still deliver its chunk; give it a moment, then finish regardless.
      watchdog.current = window.setTimeout(() => finalizeRef.current?.(), 300);
      return;
    }
    watchdog.current = window.setTimeout(() => finalizeRef.current?.(), 1500);
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
    else cleanupStream();
    setRecording(null);
    setState(recordingSupported() ? "idle" : "unsupported");
  }, []);

  const reset = useCallback(() => {
    setRecording(null);
    setError(null);
    setState(recordingSupported() ? "idle" : "unsupported");
  }, []);

  return { state, elapsed, recording, error, analyser, start, stop, pause, resume, cancel, reset };
}
