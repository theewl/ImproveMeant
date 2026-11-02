import { useEffect, useId, useRef, useState } from "react";
import type { Attempt } from "../../shared/types";
import { CAMERA_SETUP, getCameraDrill, hookText, measureCameraTake, nextCameraDrill } from "../../shared/camera";
import { fillPrompt } from "../../shared/curriculum";
import { formatSeconds } from "../../shared/observations";
import { wordCount } from "../../shared/text";
import { api, ApiRequestError } from "../lib/api";
import { useApp } from "../lib/store";
import { useSession } from "../lib/useSession";
import { uid } from "../lib/storage";
import { href } from "../lib/router";
import { stillToBase64, useVideoRecorder, videoRecordingSupported } from "../lib/useVideoRecorder";
import { isAppleWebKit, speechCaptureSupported, useSpeechCapture } from "../lib/useSpeechCapture";
import { FeedbackPanel, WrapUp } from "../components/Feedback";
import { ErrorNotice, SessionTop, StepHeader } from "../components/common";

type Phase = "setup" | "record" | "review" | "feedback" | "done";
const STEP: Record<Phase, number> = { setup: 1, record: 2, review: 3, feedback: 4, done: 4 };
const MAX_RETRIES = 2;
const HOOK_SECONDS = 10;
const VIEWER_CHECKS = ["Did the first ten seconds give a reason to stay?", "Were your eyes on the lens when it mattered?", "Did it sound like talking to one person?"];

export function CameraSession({ drillId, fromStoryId }: { drillId: string; fromStoryId?: string }) {
  const { data, update, status } = useApp();
  const drill = getCameraDrill(drillId);
  const live = status?.mode === "live";
  const transcriptionAvailable = status?.transcription === "deepgram";
  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [comfortBefore, setComfortBefore] = useState(5);
  const [comfortAfter, setComfortAfter] = useState(5);
  const [sendFrames, setSendFrames] = useState(data.cameraFramesConsent);
  const [isRetry, setIsRetry] = useState(false);
  // Remount the take only when the learner asks for another take, never while feedback is in flight.
  const [takeKey, setTakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<Attempt | null>(null);
  const [saved, setSaved] = useState(false);

  const s = useSession(() => ({
    id: uid("s-"),
    mode: "camera",
    startedAt: new Date().toISOString(),
    storyId: fromStoryId,
    exerciseId: drill.exercise.id,
    skill: drill.skill,
    camera: { drillId: drill.id, topic: "", notes: "" },
    attempts: [],
    followUps: [],
    usedLive: false,
  }));

  useEffect(() => {
    if (!fromStoryId) return;
    const own = data.ownBriefings[fromStoryId];
    if (own) {
      setTopic((t) => t || own.title);
      return;
    }
    api
      .briefing(fromStoryId)
      .then((b) => setTopic((t) => t || b.title))
      .catch(() => undefined);
  }, [fromStoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    s.setSession((x) => ({ ...x, camera: { ...(x.camera ?? { drillId: drill.id }), drillId: drill.id, topic, notes, comfortBefore: x.camera?.comfortBefore } }));
  }, [topic, notes, drill.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const task = fillPrompt(drill.prompt, { topic: topic || "your topic" });
  const attempts = s.session.attempts;
  const last = attempts[attempts.length - 1];
  const first = attempts[0];
  const retries = attempts.filter((a) => a.isRetry).length;
  const maxChars = status?.maxResponseChars ?? 6000;

  const submitTake = async (take: TakeResult) => {
    const attempt = await s.makeAttempt(
      {
        modality: "spoken",
        text: take.text,
        originalTranscript: take.original ?? undefined,
        transcriptEdited: take.original != null && take.text.trim() !== take.original.trim(),
        transcriptSource: take.source,
        durationSeconds: take.seconds,
        delivery: { basis: "recording-length-only", recordingSeconds: take.seconds, limitations: "Pace is word count over recording length. Fillers are counted in the transcript, which may omit them." },
        keepAudio: false,
      },
      { isRetry, assisted: false },
    );
    s.addAttempt(attempt);
    setPending(attempt);
    await requestFeedback(attempt, take.frames);
  };

  const requestFeedback = async (attempt: Attempt, frames: { at: number; jpegBase64: string }[]) => {
    setBusy(true);
    setError(null);
    try {
      const prev = attempt.isRetry ? last : undefined;
      const res = await api.cameraFeedback({
        idempotencyKey: attempt.id,
        drillId: drill.id,
        topic,
        notes,
        response: { text: attempt.text, transcriptSource: attempt.transcriptSource ?? "typed-by-user", transcriptEdited: attempt.transcriptEdited, durationSeconds: attempt.durationSeconds ?? null },
        frames: sendFrames ? frames : [],
        previous: prev ? { text: prev.text, retryFocus: prev.feedback?.retryFocus ?? null } : null,
      });
      s.addAttempt({ ...attempt, feedback: res.feedback });
      s.setSession((x) => ({ ...x, usedLive: x.usedLive || res.feedback.kind === "live", camera: x.camera ? { ...x.camera, framesSent: sendFrames ? frames.length : 0 } : x.camera }));
      setPending(null);
      setPhase("feedback");
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const lastFrames = useRef<{ at: number; jpegBase64: string }[]>([]);

  const finish = () => {
    s.setSession((x) => ({ ...x, camera: x.camera ? { ...x.camera, comfortAfter } : x.camera }));
    s.finish();
    setSaved(true);
  };

  const deleted = !!drill.noReview && !first?.text;
  const next = nextCameraDrill([...data.sessions.filter((x) => x.id !== s.session.id), { ...s.session, completedAt: s.session.completedAt ?? new Date().toISOString() }]);

  return (
    <main className={phase === "record" ? "screen session presenting" : "screen session"} id="main">
      <SessionTop step={STEP[phase]} total={4} label="camera drill" />

      {phase === "setup" && (
        <section>
          <StepHeader eyebrow={`Camera drill ${drill.level} · about ${formatSeconds(drill.seconds)}`} title={drill.title} />
          <p className="task">{task}</p>
          <p className="hint">{drill.why}</p>
          <ul className="plain checks">
            {drill.goodLooksLike.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (drill.needsTopic && !topic.trim()) return;
              s.setSession((x) => ({ ...x, camera: { ...(x.camera ?? { drillId: drill.id, topic, notes }), comfortBefore } }));
              setPhase("record");
            }}
          >
            {drill.needsTopic && (
              <>
                <label className="label" htmlFor="cam-topic">
                  Topic
                </label>
                <input id="cam-topic" value={topic} maxLength={300} required onChange={(e) => setTopic(e.target.value)} placeholder="e.g. why I stopped using a to-do app" />
              </>
            )}
            {!drill.noReview && (
              <>
                <label className="label" htmlFor="cam-notes">
                  Three talking points (optional, shown near the lens)
                </label>
                <textarea id="cam-notes" rows={3} maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Not a script. Three words or short lines." />
              </>
            )}
            <div className="slider">
              <div className="slider-head">
                <label className="label" htmlFor="cam-comfort">
                  How comfortable do you feel about talking to a camera right now?
                </label>
                <output htmlFor="cam-comfort">{comfortBefore}/10</output>
              </div>
              <input id="cam-comfort" type="range" min={0} max={10} value={comfortBefore} onChange={(e) => setComfortBefore(Number(e.target.value))} />
              <div className="slider-ends" aria-hidden="true">
                <span>Dreading it</span>
                <span>Easy</span>
              </div>
            </div>
            <details className="more">
              <summary>30-second warm-up</summary>
              <ul className="plain checks">
                <li>Breathe out slowly three times; drop your shoulders.</li>
                <li>Say “red leather, yellow leather” five times, fast, to wake up your mouth.</li>
                <li>Look at the lens, smile, and say “hi” to the one person you're talking to.</li>
              </ul>
            </details>
            <details className="more">
              <summary>Before you record: five checks</summary>
              <ul className="plain checks">
                {CAMERA_SETUP.map((c) => (
                  <li key={c.id}>
                    <strong>{c.text}.</strong> {c.why}
                  </li>
                ))}
              </ul>
            </details>
            {live && !drill.noReview && (
              <label className={sendFrames ? "option on" : "option"}>
                <input
                  type="checkbox"
                  checked={sendFrames}
                  onChange={(e) => {
                    setSendFrames(e.target.checked);
                    if (e.target.checked) update((d) => ({ ...d, cameraFramesConsent: true }));
                  }}
                />
                Send three still frames to the AI for feedback on framing, light and eye line. The video itself never leaves your phone; the stills aren't stored.
              </label>
            )}
            {!live && !drill.noReview && <p className="hint">Demo mode: you'll see an example of feedback, and your own measurements. AI feedback on your take needs the server's API key.</p>}
            <div className="actions sticky">
              <button className="primary" type="submit" disabled={drill.needsTopic && !topic.trim()}>
                Open the camera
              </button>
            </div>
          </form>
        </section>
      )}

      {phase === "record" && (
        <CameraTake
          key={takeKey}
          task={task}
          notes={drill.noReview ? "" : notes}
          targetSeconds={drill.seconds}
          noReview={!!drill.noReview}
          retryFocus={isRetry ? last?.feedback?.retryFocus ?? null : null}
          transcriptionAvailable={transcriptionAvailable}
          transcriptionConsent={data.transcriptionConsent}
          onConsent={() => update((d) => ({ ...d, transcriptionConsent: true }))}
          maxChars={maxChars}
          busy={busy}
          error={error}
          onRetryFeedback={() => pending && void requestFeedback(pending, lastFrames.current)}
          onDeleted={() => {
            s.addAttempt({ id: uid("a-"), createdAt: new Date().toISOString(), modality: "spoken", text: "", transcriptEdited: false, assisted: false, isRetry: false });
            finish();
            setPhase("done");
          }}
          onSubmit={(t) => {
            lastFrames.current = t.frames;
            void submitTake(t);
          }}
        />
      )}

      {phase === "feedback" && last?.feedback && (
        <section>
          <StepHeader eyebrow={drill.title} title="Your feedback" />
          <HookLine text={last.text} />
          <FeedbackPanel feedback={last.feedback} attempt={last} onRate={(r, why) => s.rateAttempt(last.id, r, why)} />
          <CameraMeasures attempt={last} />
          <div className="actions sticky">
            <button
              className="primary"
              type="button"
              onClick={() => {
                finish();
                setPhase("done");
              }}
            >
              Finish
            </button>
            {retries < MAX_RETRIES && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setIsRetry(true);
                  setError(null);
                  setTakeKey((k) => k + 1);
                  setPhase("record");
                }}
              >
                Another take
              </button>
            )}
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="done" aria-live="polite">
          <div className="done-mark" aria-hidden="true">
            ✓
          </div>
          <h2>{deleted ? "Done. Clip deleted, as promised." : "Take done"}</h2>
          <p>
            {drill.title}
            {first?.durationSeconds ? ` · ${formatSeconds(first.durationSeconds)}` : ""}
            {retries ? ` · ${retries} more take${retries === 1 ? "" : "s"}` : ""}
          </p>
          {!deleted && <WrapUp attempts={attempts} />}
          <div className="slider">
            <div className="slider-head">
              <label className="label" htmlFor="cam-after">
                And now: how comfortable do you feel about talking to a camera?
              </label>
              <output htmlFor="cam-after">{comfortAfter}/10</output>
            </div>
            <input
              id="cam-after"
              type="range"
              min={0}
              max={10}
              value={comfortAfter}
              onChange={(e) => {
                setComfortAfter(Number(e.target.value));
                s.setSession((x) => ({ ...x, camera: x.camera ? { ...x.camera, comfortAfter: Number(e.target.value) } : x.camera }));
              }}
            />
            <div className="slider-ends" aria-hidden="true">
              <span>Dreading it</span>
              <span>Easy</span>
            </div>
            {saved && comfortAfter > comfortBefore && <p className="hint">Up from {comfortBefore}/10 before. That's the repetition working.</p>}
          </div>
          <p className="hint">Next up: drill {next.level}, {next.title}.</p>
          <div className="actions">
            <a className="button primary" href={href({ name: "camera", drillId: next.id })}>
              Next drill
            </a>
            <a className="button secondary" href={href({ name: "camera" })}>
              All drills
            </a>
          </div>
        </section>
      )}
    </main>
  );
}

/** What a viewer hears first. Shown above the feedback so the learner reads their own opening as a stranger would. */
function HookLine({ text }: { text: string }) {
  const h = hookText(text);
  if (!h) return null;
  return (
    <div className="hook-line">
      <p className="eyebrow">Your first ten seconds, as a viewer hears them</p>
      <p className="hook-quote">“{h}”</p>
    </div>
  );
}

function CameraMeasures({ attempt }: { attempt: Attempt }) {
  const { data } = useApp();
  if (data.prefs.quietMode) return null;
  const m = measureCameraTake(attempt.text, attempt.durationSeconds, attempt.transcriptSource);
  return (
    <details className="more">
      <summary>Measured on this device</summary>
      <dl className="measured">
        {m.map((x) => (
          <div key={x.label}>
            <dt>{x.label}</dt>
            <dd>
              {x.value}
              <span className="basis">{x.basis}</span>
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

interface TakeResult {
  text: string;
  original: string | null;
  source: "provider" | "browser-speech" | "typed-by-user";
  seconds: number;
  frames: { at: number; jpegBase64: string }[];
}

interface TakeProps {
  task: string;
  notes: string;
  targetSeconds: number;
  noReview: boolean;
  retryFocus: string | null;
  transcriptionAvailable: boolean;
  transcriptionConsent: boolean;
  onConsent: () => void;
  maxChars: number;
  busy: boolean;
  error: unknown;
  onRetryFeedback: () => void;
  onDeleted: () => void;
  onSubmit: (t: TakeResult) => void;
}

/** Preview → record → watch back → check the transcript → send. */
function CameraTake(p: TakeProps) {
  // Apple WebKit can't run speech recognition and an audio recording together: record video only there,
  // unless a transcription service will transcribe the audio afterwards.
  const apple = isAppleWebKit();
  const videoOnly = apple && !p.transcriptionAvailable && speechCaptureSupported();
  const r = useVideoRecorder({ videoOnly });
  const speech = useSpeechCapture();
  const concurrentSpeech = speech.supported && (!apple || videoOnly);
  const { data } = useApp();
  const [transcript, setTranscript] = useState("");
  const [original, setOriginal] = useState<string | null>(null);
  const [source, setSource] = useState<TakeResult["source"]>("typed-by-user");
  const [txState, setTxState] = useState<"none" | "working" | "done" | "error">("none");
  const [txError, setTxError] = useState<string | null>(null);
  const [watched, setWatched] = useState(false);
  const [obs, setObs] = useState<"predict" | "watch" | "rate" | "done">("predict");
  const [predicted, setPredicted] = useState(5);
  const [observed, setObserved] = useState(5);
  const txKey = useRef(uid("tx-"));
  const tid = useId();
  const supported = videoRecordingSupported();

  useEffect(() => {
    if (!supported) return;
    void r.open();
    return () => r.release();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!concurrentSpeech) return;
    if (r.state === "recording") speech.start();
    else speech.stop();
  }, [r.state, concurrentSpeech]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (r.state !== "stopped" || !r.recording || txState !== "none") return;
    if (p.noReview) {
      p.onDeleted();
      return;
    }
    const t = speech.text.trim();
    if (!speech.failed && wordCount(t) >= 3) {
      setTranscript(t);
      setOriginal(t);
      setSource("browser-speech");
      setTxState("done");
    }
  }, [r.state, r.recording, speech.text, speech.failed, txState]); // eslint-disable-line react-hooks/exhaustive-deps

  const transcribe = async () => {
    if (!r.recording?.audio) return;
    setTxState("working");
    setTxError(null);
    try {
      const res = await api.transcribe(r.recording.audio, r.recording.seconds, txKey.current);
      setTranscript(res.transcript);
      setOriginal(res.transcript);
      setSource("provider");
      setTxState("done");
    } catch (e) {
      setTxError((e as ApiRequestError).message);
      setTxState("error");
    }
  };

  if (!supported || r.state === "unsupported" || r.state === "denied" || (r.state === "error" && !r.recording)) {
    return (
      <section>
        <StepHeader eyebrow="Camera" title="Camera not available" />
        <p className="notice">{r.error ?? "This browser can't record video. Try Safari on iPhone, or Chrome on Android or desktop."}</p>
        {r.state === "error" && (
          <button className="secondary" type="button" onClick={() => void r.open()}>
            Try again
          </button>
        )}
        <TypedTake {...p} />
      </section>
    );
  }

  const inHook = r.state === "recording" && r.elapsed < HOOK_SECONDS;
  const overTarget = r.state === "recording" && r.elapsed >= p.targetSeconds;

  if (r.state !== "stopped") {
    return (
      <section aria-label="Camera" className="present">
        {p.retryFocus && <p className="focus-tip">Focus: {p.retryFocus}</p>}
        <div className="cam-wrap">
          <video ref={r.attachPreview} className="cam-preview" muted playsInline autoPlay aria-label="Camera preview" />
          <svg className="cam-guide" viewBox="0 0 3 4" preserveAspectRatio="none" aria-hidden="true">
            <line x1="1" y1="0" x2="1" y2="4" />
            <line x1="2" y1="0" x2="2" y2="4" />
            <line x1="0" y1="1.33" x2="3" y2="1.33" className="eye" />
            <line x1="0" y1="2.67" x2="3" y2="2.67" />
          </svg>
          {p.notes.trim() && (
            <p className="cam-notes" aria-label="Your talking points">
              {p.notes}
            </p>
          )}
          {r.state === "recording" && (
            <p className="cam-timer" aria-live="off">
              <span className="dot pulse" aria-hidden="true" /> {formatSeconds(r.elapsed)} / {formatSeconds(p.targetSeconds)}
            </p>
          )}
          {inHook && <p className="cam-hook">Hook window: give them a reason to stay</p>}
          {overTarget && <p className="cam-hook">Target reached. Finish your thought.</p>}
        </div>
        {r.state === "ready" && <p className="cam-task">{p.task}</p>}
        {r.state === "recording" && concurrentSpeech && !speech.failed && (speech.text || speech.interim) && (
          <p className="live-transcript" aria-live="off">
            {speech.text} <span className="interim">{speech.interim}</span>
          </p>
        )}
        <div className="cam-controls">
          {r.state === "requesting" && <p className="hint">Waiting for the camera…</p>}
          {r.state === "ready" && (
            <>
              <button className="mic" type="button" onClick={r.start} aria-label="Start recording">
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                  <circle cx="12" cy="12" r="7" fill="currentColor" />
                </svg>
              </button>
              <p className="mic-caption">Eyes on the lens. Tap to record.</p>
              <p className="hint center">{videoOnly ? "On this device the browser transcribes as you talk; playback will be silent." : "Stays on your phone. Nothing is uploaded until you choose."}</p>
            </>
          )}
          {r.state === "recording" && (
            <>
              <button className="mic stop" type="button" onClick={r.stop} aria-label="Finish recording">
                <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
                </svg>
              </button>
              <p className="mic-caption">Tap to finish</p>
              <button className="link" type="button" onClick={r.cancel}>
                Cancel
              </button>
            </>
          )}
        </div>
      </section>
    );
  }

  const rec = r.recording!;
  const words = wordCount(transcript);
  const tooLong = transcript.length > p.maxChars;

  if (obs !== "done") {
    return (
      <section className="rec-box done-rec observer">
        <p className="eyebrow">Watch it back as a viewer · optional</p>
        {obs === "predict" && (
          <>
            <ObserverSlider id="cam-pred" label="Before watching: how do you think you came across?" value={predicted} onChange={setPredicted} />
            <div className="stack">
              <button className="primary" type="button" onClick={() => setObs("watch")}>
                Watch it back
              </button>
              <button className="link" type="button" onClick={() => setObs("done")}>
                Skip
              </button>
            </div>
          </>
        )}
        {obs === "watch" && (
          <>
            <p className="hint">Watch as a stranger scrolling past would. Would you keep watching after ten seconds?</p>
            <video className="playback" controls autoPlay playsInline src={rec.url} onEnded={() => setWatched(true)} aria-label={`Play back your take (${formatSeconds(rec.seconds)})`} />
            {videoOnly && <p className="hint">Silent playback on this device; the transcript below has your words.</p>}
            <fieldset className="viewer-checks">
              <legend className="label">While you watch</legend>
              {VIEWER_CHECKS.map((c) => (
                <label key={c} className="option">
                  <input type="checkbox" />
                  {c}
                </label>
              ))}
            </fieldset>
            <button className="primary" type="button" onClick={() => setObs("rate")}>
              {watched ? "Done watching" : "Skip ahead"}
            </button>
          </>
        )}
        {obs === "rate" && (
          <>
            <ObserverSlider id="cam-seen" label="As a viewer: how did they come across?" value={observed} onChange={setObserved} />
            <button className="primary" type="button" onClick={() => setObs("done")}>
              Continue
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="rec-box done-rec">
      {obs === "done" && observed !== predicted && (
        <p className="notice ok" role="status">
          {observed > predicted ? `You expected ${predicted}/10 and saw ${observed}/10. You came across better than it felt.` : `You expected ${predicted}/10 and saw ${observed}/10. Note one thing to change, then let it go.`}
        </p>
      )}
      <video className="playback" controls playsInline src={rec.url} aria-label={`Play back your take (${formatSeconds(rec.seconds)})`} />
      <p className="row wrap">
        <a className="link" href={rec.url} download={`take-${new Date().toISOString().slice(0, 10)}.${rec.mimeType.includes("mp4") ? "mp4" : "webm"}`}>
          Save this take to your device
        </a>
      </p>

      {txState !== "done" && (
        <div className="stack">
          <p className="hint">
            {concurrentSpeech && !speech.failed && txState === "none" ? "Your browser didn't catch enough words to make a transcript. " : concurrentSpeech && speech.failed ? "Your browser's speech recognition didn't work this time. " : ""}
            Feedback needs your words.
          </p>
          {p.transcriptionAvailable && rec.audio && txState !== "working" && (
            <>
              {!p.transcriptionConsent && <p className="hint">Transcribing sends only the audio to Deepgram, which is asked not to keep it.</p>}
              <button
                className="primary"
                type="button"
                onClick={() => {
                  p.onConsent();
                  void transcribe();
                }}
              >
                Transcribe the audio
              </button>
            </>
          )}
          {txState === "working" && <p className="hint">Transcribing…</p>}
          {txState === "error" && txError && (
            <p className="error-text" role="alert">
              {txError}
            </p>
          )}
          <button
            className={p.transcriptionAvailable && rec.audio ? "secondary" : "primary"}
            type="button"
            onClick={() => {
              setSource("typed-by-user");
              setOriginal(null);
              setTxState("done");
            }}
          >
            Type what I said
          </button>
        </div>
      )}

      {txState === "done" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (words < 3 || tooLong || p.busy) return;
            p.onSubmit({
              text: transcript.trim(),
              original,
              source,
              seconds: rec.seconds,
              frames: rec.frames.map((f) => ({ at: Math.round(f.at * 10) / 10, jpegBase64: stillToBase64(f.dataUrl) })),
            });
          }}
        >
          <label className="label" htmlFor={tid}>
            {source === "typed-by-user" ? "Type what you said, then get feedback" : "Check the transcript, fix any mistakes, then get feedback"}
          </label>
          <textarea id={tid} rows={7} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          <p className="hint" aria-live="polite">
            {tooLong ? `Too long: limit ${p.maxChars} characters` : `${words} words · ${formatSeconds(rec.seconds)}${rec.frames.length ? ` · ${rec.frames.length} still${rec.frames.length === 1 ? "" : "s"} ready` : ""}`}
          </p>
          <button className="primary" type="submit" disabled={words < 3 || tooLong || p.busy} aria-busy={p.busy}>
            {p.busy ? "Getting feedback…" : "Get feedback"}
          </button>
          {p.error != null && <ErrorNotice error={p.error} onRetry={p.onRetryFeedback} />}
          {!data.prefs.quietMode && <p className="hint">Measured here: pace, fillers, general words, and how often you said “you”.</p>}
        </form>
      )}
    </section>
  );
}

/** Fallback when there is no camera: describe the take in words so the drill still counts. */
function TypedTake(p: TakeProps) {
  const [text, setText] = useState("");
  const id = useId();
  const words = wordCount(text);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (words < 3 || p.busy) return;
        p.onSubmit({ text: text.trim(), original: null, source: "typed-by-user", seconds: 0, frames: [] });
      }}
    >
      <label className="label" htmlFor={id}>
        No camera here? Say it out loud to your phone's camera app, then type what you said to get feedback on the words.
      </label>
      <textarea id={id} rows={6} value={text} maxLength={p.maxChars} onChange={(e) => setText(e.target.value)} />
      <button className="primary" type="submit" disabled={words < 3 || p.busy} aria-busy={p.busy}>
        {p.busy ? "Getting feedback…" : "Get feedback"}
      </button>
      {p.error != null && <ErrorNotice error={p.error} onRetry={p.onRetryFeedback} />}
    </form>
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
        <span>Stiff, unclear</span>
        <span>Natural, clear</span>
      </div>
    </div>
  );
}
