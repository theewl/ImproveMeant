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
  selfView?: { predicted: number; observed: number };
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
      <label htmlFor={id} className="sr-only">
        {p.label}
      </label>
      <textarea id={id} rows={6} value={p.value} onChange={(e) => p.onChange(e.target.value)} placeholder={p.placeholder ?? "Write it the way you'd say it."} aria-describedby={`${id}-count`} />
      <p id={`${id}-count`} className={tooLong ? "hint error-text" : "hint"} aria-live="polite">
        {tooLong ? `Too long — limit ${p.maxChars} characters` : words > 0 ? `${words} words` : "\u00a0"}
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
  // Observer review (talk mode): rate how you came across, listen back as an audience member, rate again.
  const [obs, setObs] = useState<"predict" | "listen" | "rate" | "done" | "off">(p.focused ? "predict" : "off");
  const [predicted, setPredicted] = useState(4);
  const [observed, setObserved] = useState(5);
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
      <div className="rec-box">
        {r.error && (
          <p className="error-text" role="alert">
            {r.error}
          </p>
        )}
        <button className="mic" type="button" onClick={r.start} disabled={r.state === "requesting"} aria-label={r.state === "requesting" ? "Waiting for microphone" : "Start recording"}>
          <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <p className="mic-caption">{r.state === "requesting" ? "Waiting for microphone…" : "Tap to record"}</p>
        <p className="hint center">Stays on your device unless you transcribe it.</p>
      </div>
    );
  }

  if (r.state === "recording") {
    return (
      <div className="rec-box live">
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
        {overTarget && <p className="hint" role="status">Target reached — finish your thought.</p>}
        <div className="row">
          <button className="primary" type="button" onClick={r.stop}>
            Finish
          </button>
          <button className="link" type="button" onClick={r.cancel}>
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

  if (obs === "predict" || obs === "listen" || obs === "rate") {
    return (
      <div className="rec-box done-rec observer">
        <p className="eyebrow">Listen back as an observer · optional</p>
        {obs === "predict" && (
          <>
            <ObserverSlider id="obs-pred" label="Before listening: how do you think you came across?" value={predicted} onChange={setPredicted} />
            <div className="stack">
              <button className="primary" type="button" onClick={() => setObs("listen")}>
                Listen back
              </button>
              <button className="link" type="button" onClick={() => setObs("off")}>
                Skip
              </button>
            </div>
          </>
        )}
        {obs === "listen" && (
          <>
            <p className="hint">Listen as if you were in the audience, hearing someone else.</p>
            <audio controls autoPlay src={rec.url} aria-label={`Play back your recording (${formatSeconds(rec.seconds)})`} onEnded={() => setObs("rate")} />
            <button className="primary" type="button" onClick={() => setObs("rate")}>
              Done listening
            </button>
          </>
        )}
        {obs === "rate" && (
          <>
            <ObserverSlider id="obs-seen" label="As an audience member: how did they come across?" value={observed} onChange={setObserved} />
            <button className="primary" type="button" onClick={() => setObs("done")}>
              Save
            </button>
          </>
        )}
      </div>
    );
  }
  const selfView = obs === "done" ? { predicted, observed } : undefined;
  const edited = original != null && transcript.trim() !== original.trim();
  const words = wordCount(transcript);
  const tooLong = transcript.length > p.maxChars;
  return (
    <div className="rec-box done-rec">
      {selfView && (
        <p className="notice ok" role="status">
          {selfView.observed > selfView.predicted
            ? `You expected ${selfView.predicted}/10 and heard ${selfView.observed}/10 — you came across better than it felt.`
            : selfView.observed === selfView.predicted
              ? `You expected ${selfView.predicted}/10 and heard the same. Your sense of yourself was accurate.`
              : `You expected ${selfView.predicted}/10 and heard ${selfView.observed}/10. Worth noting what you'd change — then let it go.`}
        </p>
      )}
      <audio controls src={rec.url} aria-label={`Play back your recording (${formatSeconds(rec.seconds)})`} />

      {txState === "none" && (
        <div className="stack">
          {p.transcriptionAvailable ? (
            <>
              {!p.transcriptionConsent && <p className="hint">Transcribing sends this audio to Deepgram, which is asked not to keep it.</p>}
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
            <p className="hint">Listen back, then type what you said.</p>
          )}
          <button className={p.transcriptionAvailable ? "secondary" : "primary"} type="button" onClick={() => setTxState("manual")}>
            Type what I said
          </button>
          <button className="link" type="button" onClick={() => { resetTranscript(); r.reset(); }}>
            Record again
          </button>
          <label className="check small">
            <input type="checkbox" checked={keepAudio} onChange={(e) => setKeepAudio(e.target.checked)} />
            Keep this recording on this device
          </label>
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
              selfView,
            });
          }}
        >
          <label className="label" htmlFor={tid}>
            {txState === "manual" ? "Type what you said" : "Check the transcript and fix any mistakes"}
          </label>
          <textarea id={tid} rows={7} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          <p className="hint" aria-live="polite">
            {tooLong ? `Too long — limit ${p.maxChars} characters` : `${words} words${edited ? " · edited" : ""}`}
          </p>
          <button className="primary" type="submit" disabled={words < 3 || tooLong || p.busy} aria-busy={p.busy}>
            {p.busy ? "Working…" : p.submitLabel}
          </button>
        </form>
      )}
    </div>
  );
}

function ObserverSlider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="slider">
      <div className="slider-head">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <output htmlFor={id}>{value}/10</output>
      </div>
      <input id={id} type="range" min={0} max={10} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="slider-ends" aria-hidden="true">
        <span>Nervous, unclear</span>
        <span>Calm, clear</span>
      </div>
    </div>
  );
}
