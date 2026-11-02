import { useEffect, useId, useRef, useState } from "react";
import type { DeliveryMetrics, Modality } from "../../shared/types";
import { formatSeconds } from "../../shared/observations";
import { wordCount } from "../../shared/text";
import { api, ApiRequestError } from "../lib/api";
import { uid } from "../lib/storage";
import { useRecorder, recordingSupported } from "../lib/useRecorder";

export interface AttemptDraft {
  modality: Modality;
  text: string;
  originalTranscript?: string;
  transcriptEdited: boolean;
  transcriptSource?: "provider" | "typed-by-user";
  durationSeconds?: number;
  delivery?: DeliveryMetrics;
  audioBlob?: Blob;
  keepAudio: boolean;
}

interface Props {
  label: string;
  transcriptionAvailable: boolean;
  transcriptionConsent: boolean;
  onConsent: () => void;
  maxChars: number;
  busy: boolean;
  submitLabel: string;
  onSubmit: (d: AttemptDraft) => void;
  targetSeconds?: number;
  /** Talk mode shows a larger, focused recording view. */
  focused?: boolean;
  defaultModality?: Modality;
  placeholder?: string;
}

export function ResponseCapture(p: Props) {
  const canRecord = recordingSupported();
  const [modality, setModality] = useState<Modality>(canRecord ? (p.defaultModality ?? "spoken") : "typed");
  const [typed, setTyped] = useState("");
  const tabsId = useId();

  return (
    <div className="capture">
      <div role="tablist" aria-label={`${p.label}: choose how to answer`} className="segmented">
        <button role="tab" id={`${tabsId}-speak`} aria-selected={modality === "spoken"} aria-controls={`${tabsId}-panel`} className={modality === "spoken" ? "seg on" : "seg"} onClick={() => setModality("spoken")} type="button">
          Speak
        </button>
        <button role="tab" id={`${tabsId}-type`} aria-selected={modality === "typed"} aria-controls={`${tabsId}-panel`} className={modality === "typed" ? "seg on" : "seg"} onClick={() => setModality("typed")} type="button">
          Type
        </button>
      </div>
      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${modality === "spoken" ? "speak" : "type"}`}>
        {modality === "typed" ? (
          <TypedAnswer {...p} value={typed} onChange={setTyped} />
        ) : (
          <SpokenAnswer {...p} onSwitchToTyped={() => setModality("typed")} />
        )}
      </div>
    </div>
  );
}

function TypedAnswer(p: Props & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const words = wordCount(p.value);
  const tooLong = p.value.length > p.maxChars;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (words < 3 || tooLong || p.busy) return;
        p.onSubmit({ modality: "typed", text: p.value.trim(), transcriptEdited: false, keepAudio: false });
      }}
    >
      <label htmlFor={id} className="label">
        {p.label}
      </label>
      <textarea id={id} rows={7} value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.placeholder ?? "Write it the way you'd say it."} aria-describedby={`${id}-count`} />
      <p id={`${id}-count`} className={tooLong ? "hint error-text" : "hint"} aria-live="polite">
        {words} words{tooLong ? ` — too long (limit ${p.maxChars} characters)` : ""}
      </p>
      <button className="primary" type="submit" disabled={words < 3 || tooLong || p.busy} aria-busy={p.busy}>
        {p.busy ? "Working…" : p.submitLabel}
      </button>
    </form>
  );
}

function SpokenAnswer(p: Props & { onSwitchToTyped: () => void }) {
  const r = useRecorder();
  const [showTimer, setShowTimer] = useState(true);
  const [transcript, setTranscript] = useState<string>("");
  const [original, setOriginal] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryMetrics | undefined>();
  const [txState, setTxState] = useState<"none" | "working" | "done" | "error" | "manual">("none");
  const [txError, setTxError] = useState<string | null>(null);
  const [keepAudio, setKeepAudio] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const txKey = useRef(uid("tx-"));
  const tid = useId();

  useEffect(() => () => abort.current?.abort(), []);

  const resetTranscript = () => {
    setTranscript("");
    setOriginal(null);
    setDelivery(undefined);
    setTxState("none");
    setTxError(null);
    txKey.current = uid("tx-");
  };

  const transcribe = async () => {
    if (!r.recording) return;
    abort.current = new AbortController();
    setTxState("working");
    setTxError(null);
    try {
      const res = await api.transcribe(r.recording.blob, r.recording.seconds, txKey.current, abort.current.signal);
      setTranscript(res.transcript);
      setOriginal(res.transcript);
      setDelivery(res.delivery);
      setTxState("done");
    } catch (e) {
      const err = e as ApiRequestError;
      if (err.message === "Cancelled.") {
        setTxState("none");
        return;
      }
      setTxError(err.message);
      setTxState("error");
    }
  };

  const target = p.targetSeconds;
  const overTarget = target != null && r.elapsed >= target;

  if (r.state === "unsupported" || r.state === "denied") {
    return (
      <div className="notice" role="status">
        <p>{r.error ?? "Recording isn't supported in this browser."}</p>
        <button className="primary" type="button" onClick={p.onSwitchToTyped}>
          Type your answer instead
        </button>
      </div>
    );
  }

  if (r.state === "idle" || r.state === "requesting" || (r.state === "error" && !r.recording)) {
    return (
      <div className={p.focused ? "rec-box focused" : "rec-box"}>
        {r.error && (
          <p className="error-text" role="alert">
            {r.error}
          </p>
        )}
        <p className="hint">Your recording stays in this browser unless you choose to send it for transcription.</p>
        <button className="primary record" type="button" onClick={r.start} disabled={r.state === "requesting"}>
          <span className="dot" aria-hidden="true" /> {r.state === "requesting" ? "Waiting for microphone…" : "Start recording"}
        </button>
        <button className="link" type="button" onClick={p.onSwitchToTyped}>
          Prefer to type?
        </button>
      </div>
    );
  }

  if (r.state === "recording") {
    return (
      <div className={p.focused ? "rec-box focused live" : "rec-box live"}>
        <p className="rec-indicator" aria-live="off">
          <span className="dot pulse" aria-hidden="true" /> Recording
        </p>
        {showTimer ? (
          <p className="timer" aria-label={`Elapsed ${Math.round(r.elapsed)} seconds`}>
            {formatSeconds(r.elapsed)}
            {target ? <span className="timer-target"> / {formatSeconds(target)}</span> : null}
          </p>
        ) : (
          <p className="timer muted">Timer hidden</p>
        )}
        {overTarget && <p className="hint" role="status">Target time reached — finish your thought, then stop when ready.</p>}
        <div className="row">
          <button className="primary" type="button" onClick={r.stop}>
            Finish
          </button>
          <button className="secondary" type="button" onClick={r.cancel}>
            Cancel
          </button>
          <button className="link" type="button" onClick={() => setShowTimer((s) => !s)} aria-pressed={!showTimer}>
            {showTimer ? "Hide timer" : "Show timer"}
          </button>
        </div>
      </div>
    );
  }

  // stopped (or error with recording)
  const rec = r.recording!;
  const edited = original != null && transcript.trim() !== original.trim();
  const words = wordCount(transcript);
  const tooLong = transcript.length > p.maxChars;
  return (
    <div className="rec-box">
      <p className="label">Your recording ({formatSeconds(rec.seconds)})</p>
      <audio controls src={rec.url} aria-label="Play back your recording" />
      <label className="check">
        <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
        Keep this recording on this device (you can delete it later)
      </label>

      {txState === "none" && (
        <div className="stack">
          {p.transcriptionAvailable ? (
            <>
              {!p.transcriptionConsent && (
                <p className="hint">
                  To get feedback, the audio is sent to Deepgram for transcription. The server asks Deepgram not to retain it, and this app's server doesn't
                  store audio.
                </p>
              )}
              <button
                className="primary"
                type="button"
                onClick={() => {
                  if (!p.transcriptionConsent) p.onConsent();
                  void transcribe();
                }}
              >
                {p.transcriptionConsent ? "Transcribe" : "I understand — transcribe"}
              </button>
            </>
          ) : (
            <p className="hint">Automatic transcription isn't set up on this server. Listen back and type what you said, as closely as you can.</p>
          )}
          <button className="secondary" type="button" onClick={() => setTxState("manual")}>
            Type what I said
          </button>
          <button className="link" type="button" onClick={() => { resetTranscript(); r.reset(); }}>
            Record again
          </button>
        </div>
      )}
      {txState === "working" && (
        <div className="row" role="status">
          <span className="spinner" aria-hidden="true" /> Transcribing…
          <button className="link" type="button" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      )}
      {txState === "error" && (
        <div className="notice error" role="alert">
          <p>Transcription failed: {txError}</p>
          <div className="row">
            <button className="secondary" type="button" onClick={transcribe}>
              Try again
            </button>
            <button className="secondary" type="button" onClick={() => setTxState("manual")}>
              Type what I said
            </button>
          </div>
        </div>
      )}
      {(txState === "done" || txState === "manual") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (words < 3 || tooLong || p.busy) return;
            const manual = txState === "manual";
            p.onSubmit({
              modality: "spoken",
              text: transcript.trim(),
              originalTranscript: !manual && edited ? original! : undefined,
              transcriptEdited: manual || edited,
              transcriptSource: manual ? "typed-by-user" : "provider",
              durationSeconds: rec.seconds,
              delivery: manual ? { basis: "recording-length-only", recordingSeconds: rec.seconds, limitations: "No automatic transcript, so pace and pauses weren't measured." } : delivery,
              audioBlob: rec.blob,
              keepAudio,
            });
          }}
        >
          <label className="label" htmlFor={tid}>
            {txState === "manual" ? "Type what you said" : "Check the transcript — fix any recognition mistakes"}
          </label>
          <textarea id={tid} rows={7} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          <p className="hint" aria-live="polite">
            {words} words
            {edited ? " · Edited — feedback will note this, and pace numbers come from the original recording." : ""}
            {txState === "manual" ? " · Typed by you from the recording." : ""}
            {tooLong ? ` · Too long (limit ${p.maxChars} characters)` : ""}
          </p>
          <button className="primary" type="submit" disabled={words < 3 || tooLong || p.busy} aria-busy={p.busy}>
            {p.busy ? "Working…" : p.submitLabel}
          </button>
        </form>
      )}
    </div>
  );
}
