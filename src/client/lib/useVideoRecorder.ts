import { useCallback, useEffect, useRef, useState } from "react";

export type VideoRecorderState = "idle" | "requesting" | "ready" | "recording" | "stopped" | "denied" | "unsupported" | "error";

export interface VideoRecording {
  blob: Blob;
  url: string;
  seconds: number;
  mimeType: string;
  /** Audio-only copy of the take for transcription (small). Absent when the browser can't make one. */
  audio: Blob | null;
  /** Up to three downscaled JPEG stills, as data URLs. */
  frames: { at: number; dataUrl: string }[];
}

export interface Still {
  at: number;
  /** base64 JPEG without the data: prefix. */
  jpegBase64: string;
}

const VIDEO_TYPES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"];
const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const STILL_WIDTH = 640;
const STILL_EVERY_SECONDS = 8;
const FIRST_STILL_AT = 2;

export function videoRecordingSupported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function pick(types: string[]): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return types.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Choose up to three stills spread across the take: start, middle, end. */
export function chooseStills<T extends { at: number }>(all: T[]): T[] {
  if (all.length <= 3) return all;
  const first = all[0]!;
  const last = all[all.length - 1]!;
  const mid = all[Math.floor(all.length / 2)]!;
  return [first, mid, last];
}

export function stillToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

/**
 * Front-camera recording with a live preview, periodic stills and an audio-only
 * companion recording. `videoOnly` records without an audio track so the
 * microphone stays free for the browser's speech recognition (Apple WebKit).
 * Nothing is uploaded by this hook; the screen decides what to send.
 */
export function useVideoRecorder(opts: { videoOnly: boolean }) {
  const [state, setState] = useState<VideoRecorderState>(videoRecordingSupported() ? "idle" : "unsupported");
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState<VideoRecording | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoEl = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const audioRec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const audioChunks = useRef<Blob[]>([]);
  const stills = useRef<{ at: number; dataUrl: string }[]>([]);
  const startedAt = useRef(0);
  const timer = useRef<number | null>(null);
  const stillTimer = useRef<number | null>(null);
  const watchdog = useRef<number | null>(null);
  const finalized = useRef(false);
  const finalizeRef = useRef<(() => void) | null>(null);
  const cancelled = useRef(false);
  const tornDown = useRef(false);
  const [errorKind, setErrorKind] = useState<"short" | "other" | null>(null);
  const videoOnly = opts.videoOnly;

  const elapsedNow = () => (performance.now() - startedAt.current) / 1000;

  const clearTimers = () => {
    if (timer.current) window.clearInterval(timer.current);
    if (stillTimer.current) window.clearInterval(stillTimer.current);
    if (watchdog.current) window.clearTimeout(watchdog.current);
    timer.current = stillTimer.current = watchdog.current = null;
  };

  const releaseCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (videoEl.current) videoEl.current.srcObject = null;
  }, []);

  useEffect(
    () => () => {
      cancelled.current = true;
      tornDown.current = true;
      clearTimers();
      try {
        rec.current?.stop();
        audioRec.current?.stop();
      } catch {
        /* already stopped */
      }
      releaseCamera();
    },
    [releaseCamera],
  );

  useEffect(() => () => {
    if (recording) URL.revokeObjectURL(recording.url);
  }, [recording]);

  /** Attach the preview element (call from a ref callback). */
  const attachPreview = useCallback((el: HTMLVideoElement | null) => {
    videoEl.current = el;
    if (el && stream.current) {
      el.srcObject = stream.current;
      void el.play().catch(() => undefined);
    }
  }, []);

  /** Ask for the camera and show the preview. Separate from start so the learner can frame the shot first. */
  const open = useCallback(async () => {
    if (!videoRecordingSupported()) {
      setState("unsupported");
      return;
    }
    setError(null);
    setErrorKind(null);
    setRecording(null);
    setState("requesting");
    try {
      const got = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: !videoOnly ? true : false,
      });
      if (tornDown.current) {
        // The screen was left while the permission prompt was open: don't leave the camera on.
        got.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = got;
    } catch (err) {
      const name = (err as Error).name;
      const blocked = name === "NotAllowedError" || name === "SecurityError";
      setState(blocked ? "denied" : "error");
      setError(
        blocked
          ? "Camera access was blocked. Allow the camera (and microphone) in your browser's site settings, then try again."
          : name === "NotFoundError"
            ? "No camera was found on this device."
            : "The camera couldn't be started.",
      );
      return;
    }
    if (videoEl.current) {
      videoEl.current.srcObject = stream.current;
      void videoEl.current.play().catch(() => undefined);
    }
    setState("ready");
  }, [videoOnly]);

  const captureStill = () => {
    const v = videoEl.current;
    if (!v || v.readyState < 2 || !v.videoWidth) return;
    try {
      const scale = Math.min(1, STILL_WIDTH / v.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      if (dataUrl.startsWith("data:image/jpeg")) stills.current.push({ at: elapsedNow(), dataUrl });
    } catch {
      /* canvas unavailable */
    }
  };

  const start = useCallback(() => {
    const s = stream.current;
    if (!s) return;
    const mimeType = pick(VIDEO_TYPES);
    let mr: MediaRecorder;
    try {
      mr = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
    } catch {
      setState("error");
      setError("This browser can't record video in a supported format.");
      return;
    }
    chunks.current = [];
    audioChunks.current = [];
    stills.current = [];
    cancelled.current = false;
    finalized.current = false;
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.current.push(e.data);
    };
    // Audio-only companion (much smaller than the video) for transcription.
    let ar: MediaRecorder | null = null;
    if (!videoOnly && s.getAudioTracks().length) {
      try {
        const aType = pick(AUDIO_TYPES);
        ar = new MediaRecorder(new MediaStream(s.getAudioTracks()), aType ? { mimeType: aType } : undefined);
        ar.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunks.current.push(e.data);
        };
      } catch {
        ar = null;
      }
    }
    const finalize = () => {
      if (finalized.current) return;
      finalized.current = true;
      const seconds = elapsedNow();
      clearTimers();
      try {
        if (audioRec.current && audioRec.current.state !== "inactive") audioRec.current.stop();
      } catch {
        /* ignore */
      }
      // Let the companion recorder flush, then build the result.
      window.setTimeout(() => {
        releaseCamera();
        if (cancelled.current) {
          setState("idle");
          return;
        }
        const type = mr.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunks.current, { type });
        if (blob.size < 2000 || seconds < 1) {
          setState("error");
          setErrorKind("short");
          setError("That take was empty or too short. Try again.");
          return;
        }
        const audio = audioChunks.current.length ? new Blob(audioChunks.current, { type: audioRec.current?.mimeType || "audio/webm" }) : null;
        setRecording({ blob, url: URL.createObjectURL(blob), seconds, mimeType: type, audio, frames: chooseStills(stills.current) });
        setState("stopped");
      }, 250);
    };
    finalizeRef.current = finalize;
    mr.onstop = finalize;
    mr.onerror = () => finalize();
    for (const track of s.getTracks()) track.onended = () => finalize();
    rec.current = mr;
    audioRec.current = ar;
    startedAt.current = performance.now();
    setElapsed(0);
    try {
      mr.start(1000);
    } catch {
      releaseCamera();
      setState("error");
      setErrorKind("other");
      setError("The camera stopped before recording could start. Try again.");
      return;
    }
    try {
      ar?.start(1000);
    } catch {
      audioRec.current = null;
    }
    timer.current = window.setInterval(() => setElapsed(elapsedNow()), 250);
    window.setTimeout(captureStill, FIRST_STILL_AT * 1000);
    stillTimer.current = window.setInterval(captureStill, STILL_EVERY_SECONDS * 1000);
    setState("recording");
  }, [videoOnly, releaseCamera]);

  /** Stop and finish. Never leaves the UI stuck on "Recording". */
  const stop = useCallback(() => {
    const mr = rec.current;
    if (!mr) return;
    captureStill();
    if (mr.state === "inactive") {
      finalizeRef.current?.();
      return;
    }
    try {
      if (typeof mr.requestData === "function") mr.requestData();
      mr.stop();
    } catch {
      watchdog.current = window.setTimeout(() => finalizeRef.current?.(), 300);
      return;
    }
    watchdog.current = window.setTimeout(() => finalizeRef.current?.(), 1500);
  }, []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    clearTimers();
    try {
      if (rec.current && rec.current.state !== "inactive") rec.current.stop();
      else releaseCamera();
    } catch {
      releaseCamera();
    }
    setRecording(null);
    setState(videoRecordingSupported() ? "idle" : "unsupported");
  }, [releaseCamera]);

  /** Back to the preview for another take. */
  const reset = useCallback(() => {
    setRecording(null);
    setError(null);
    setState(videoRecordingSupported() ? "idle" : "unsupported");
  }, []);

  return { state, elapsed, recording, error, errorKind, attachPreview, open, start, stop, cancel, reset, release: releaseCamera };
}
