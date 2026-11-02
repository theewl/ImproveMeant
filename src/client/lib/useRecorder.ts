import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "stopped" | "denied" | "unsupported" | "error";

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

  const cleanupStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
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
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.current.push(e.data);
    };
    mr.onstop = () => {
      const seconds = (performance.now() - startedAt.current) / 1000;
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
    rec.current = mr;
    startedAt.current = performance.now();
    setElapsed(0);
    mr.start(1000);
    timer.current = window.setInterval(() => setElapsed((performance.now() - startedAt.current) / 1000), 250);
    setState("recording");
  }, []);

  const stop = useCallback(() => {
    if (rec.current && rec.current.state !== "inactive") rec.current.stop();
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

  return { state, elapsed, recording, error, start, stop, cancel, reset };
}
