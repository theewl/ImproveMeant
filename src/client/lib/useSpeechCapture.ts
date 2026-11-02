import { useCallback, useEffect, useRef, useState } from "react";

// Free, built-in transcription via the Web Speech API (Chrome, Edge, Safari on iOS/macOS).
// Runs alongside MediaRecorder so a transcript is ready the moment the recording stops.
// Accuracy varies by browser and device; the learner always checks the transcript first.
// Some browsers send audio to a speech service to do this; we say so in the UI.

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

export function speechRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * WebKit (every browser on iOS, and Safari on macOS) can't run speech recognition and
 * MediaRecorder on the microphone at the same time: starting one stops the other.
 */
export function isAppleWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (/AppleWebKit/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Android/.test(ua));
}

export function speechCaptureSupported(): boolean {
  return speechRecognitionCtor() !== null;
}

export function useSpeechCapture() {
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [failed, setFailed] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const active = useRef(false);
  const finals = useRef<string[]>([]);

  const stop = useCallback(() => {
    active.current = false;
    try {
      rec.current?.stop();
    } catch {
      /* already stopped */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor || active.current) return;
    let r: RecognitionLike;
    try {
      r = new Ctor();
    } catch {
      setFailed("unavailable");
      return;
    }
    r.continuous = true;
    r.interimResults = true;
    r.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = res[0].transcript;
        if (res.isFinal) finals.current.push(t.trim());
        else interimText += t;
      }
      setText(finals.current.join(" ").replace(/\s+/g, " ").trim());
      setInterim(interimText.trim());
    };
    r.onerror = (e) => {
      const code = e.error ?? "error";
      // "no-speech" and "aborted" are routine; anything else means we can't rely on it.
      if (code !== "no-speech" && code !== "aborted") {
        setFailed(code);
        active.current = false;
      }
    };
    r.onend = () => {
      // Browsers stop after silence or a time limit; keep going while the recording is active.
      if (active.current) {
        try {
          r.start();
        } catch {
          active.current = false;
        }
      }
    };
    rec.current = r;
    active.current = true;
    finals.current = [];
    setText("");
    setInterim("");
    setFailed(null);
    try {
      r.start();
    } catch {
      setFailed("unavailable");
      active.current = false;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    finals.current = [];
    setText("");
    setInterim("");
    setFailed(null);
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported: speechCaptureSupported(), text, interim, failed, start, stop, reset };
}
