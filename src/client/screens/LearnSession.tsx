import { useEffect, useState } from "react";
import type { Attempt, Briefing } from "../../shared/types";
import { fillPrompt, getExercise, pickLearnExercise, SKILLS } from "../../shared/curriculum";
import { PLAN, currentWeek } from "../../shared/plan";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { useSession } from "../lib/useSession";
import { uid } from "../lib/storage";
import { addReviewItem, buildReviewItem, type SaveChoice } from "../lib/state";
import { href } from "../lib/router";
import { ResponseCapture, type AttemptDraft } from "../components/ResponseCapture";
import { CompareAttempts, FeedbackPanel } from "../components/Feedback";
import { ErrorNotice, Loading, SessionTop, SourceLine, StepHeader, formatDate, useFocusMode } from "../components/common";

type Phase = "understand" | "recall" | "improve" | "retry" | "apply" | "save" | "done";
const MAX_RETRIES = 2;
const STEP: Record<Phase, number> = { understand: 1, recall: 2, retry: 2, improve: 3, apply: 4, save: 4, done: 4 };

/** The briefing body. `compact` is used when peeking during recall. */
export function BriefingView({ b, compact = false }: { b: Briefing & { sourceChanged?: boolean }; compact?: boolean }) {
  return (
    <article className="briefing" aria-label="Briefing">
      <ul className="points">
        {b.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {b.uncertainty && (
        <p className="note">
          <strong>Worth knowing:</strong> {b.uncertainty}
        </p>
      )}
      <div className="term">
        <p className="eyebrow">Phrase to use</p>
        <p className="term-word">{b.keyTerm.term}</p>
        <p>{b.keyTerm.meaning}</p>
        <p className="example">“{b.keyTerm.exampleUse}”</p>
      </div>
      {!compact && (
        <details className="more">
          <summary>About this summary</summary>
          <p className="hint">
            {b.generatedBy === "curated"
              ? "Written for this app as a short summary. The source has the full detail."
              : `AI summary of the source text, retrieved ${formatDate(b.source.retrievedAt)}${b.coverage === "partial" ? " (first part of a long article)" : ""}. Check the source before relying on details.`}
          </p>
          {b.keyTerm.inContext && <blockquote>From the source: “{b.keyTerm.inContext}”</blockquote>}
          {b.supportingExcerpts.length > 0 && (
            <ul className="excerpts">
              {b.supportingExcerpts.map((e) => (
                <li key={e}>
                  <q>{e}</q>
                </li>
              ))}
            </ul>
          )}
          {b.source.byline && <p className="hint">Source text: {b.source.byline}.</p>}
        </details>
      )}
    </article>
  );
}

export function LearnSession({ storyId }: { storyId: string }) {
  useFocusMode();
  const { data, update, status } = useApp();
  // Fixed for the whole session (finishing increments the completed count).
  const [exercise] = useState(() => {
    // In a guided plan, practise this week's skill; otherwise rotate through skills.
    if (data.plan) {
      const wk = PLAN[currentWeek(data.plan, new Date().toISOString()) - 1];
      if (wk) return getExercise(wk.learnExerciseId);
    }
    return pickLearnExercise(data.sessions.filter((s) => s.mode === "learn" && s.completedAt).length);
  });
  const followUpExercise = getExercise("fu-answer-directly");
  const [briefing, setBriefing] = useState<(Briefing & { sourceChanged: boolean }) | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [phase, setPhase] = useState<Phase>("understand");
  const [peeked, setPeeked] = useState(false);
  const [pending, setPending] = useState<Attempt | null>(null);
  const [saveChoice, setSaveChoice] = useState<SaveChoice | "none">("idea");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [answeringFollowUp, setAnsweringFollowUp] = useState(false);

  const s = useSession(() => ({
    id: uid("s-"),
    mode: "learn",
    startedAt: new Date().toISOString(),
    storyId,
    exerciseId: exercise.id,
    skill: exercise.skill,
    attempts: [],
    followUps: [],
    usedLive: false,
  }));

  const load = (refresh = false) => {
    setLoadError(null);
    api
      .briefing(storyId, refresh)
      .then((b) => {
        setBriefing(b);
        s.setSession((x) => ({ ...x, storyTitle: b.title, storySource: b.source, keyTerm: b.keyTerm }));
      })
      .catch(setLoadError);
  };
  useEffect(() => load(), [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <main className="screen" id="main">
        <SessionTop step={1} total={4} label="session" />
        <h2>Couldn't open this story</h2>
        <ErrorNotice error={loadError} onRetry={() => load()}>
          <a className="button secondary" href={href({ name: "today" })}>
            Pick another
          </a>
        </ErrorNotice>
      </main>
    );
  }
  if (!briefing) {
    return (
      <main className="screen" id="main">
        <SessionTop step={1} total={4} label="session" />
        <Loading label="Preparing your briefing…" />
      </main>
    );
  }

  const task = fillPrompt(exercise.prompt, { topic: briefing.title });
  const mainAttempts = s.session.attempts.filter((a) => !s.session.followUps.some((f) => f.answer?.id === a.id));
  const last = mainAttempts[mainAttempts.length - 1];
  const first = mainAttempts[0];
  const retries = mainAttempts.filter((a) => a.isRetry).length;
  const capture = {
    transcriptionAvailable: status?.transcription === "deepgram",
    transcriptionConsent: data.transcriptionConsent,
    onConsent: () => update((d) => ({ ...d, transcriptionConsent: true })),
    maxChars: status?.maxResponseChars ?? 6000,
    busy: s.busy,
  };

  const submitMain = async (draft: AttemptDraft | null, isRetry: boolean) => {
    const attempt = pending ?? (draft ? await s.makeAttempt(draft, { isRetry, assisted: peeked }) : null);
    if (!attempt) return;
    setPending(attempt);
    const prev = isRetry ? last : undefined;
    const fb = await s.getFeedback(attempt, {
      exerciseId: exercise.id,
      mode: "learn",
      storyId,
      previous: prev ? { text: prev.text, retryFocus: prev.feedback?.retryFocus ?? null } : null,
    });
    if (!fb) return;
    s.addAttempt({ ...attempt, feedback: fb });
    setPending(null);
    setPeeked(false);
    setPhase("improve");
  };

  const submitFollowUp = async (draft: AttemptDraft | null) => {
    const attempt = pending ?? (draft ? await s.makeAttempt(draft, { isRetry: false, assisted: false }) : null);
    if (!attempt) return;
    setPending(attempt);
    const fb = await s.getFeedback(attempt, {
      exerciseId: followUpExercise.id,
      mode: "learn",
      target: "followup",
      storyId,
      followUp: { question: briefing.followUpQuestion, answer: attempt.text },
    });
    if (!fb) return;
    const answered = { ...attempt, feedback: fb };
    s.setSession((x) => ({
      ...x,
      attempts: [...x.attempts, answered],
      followUps: [{ question: { kind: "sample", question: briefing.followUpQuestion, intent: "Follow-up question from the briefing." }, answer: answered }],
    }));
    setPending(null);
  };

  const followUpAnswer = s.session.followUps[0]?.answer;

  const finishSession = () => {
    if (saveChoice !== "none") {
      const item = buildReviewItem(saveChoice, { briefing, exerciseId: exercise.id, skill: exercise.skill }, new Date().toISOString());
      const { added } = addReviewItem(data, item);
      if (added) update((d) => addReviewItem(d, item).data);
      setSaveMsg(added ? `We'll ask you about it on ${formatDate(item.dueAt)}.` : "That's already in your reviews.");
    }
    s.finish();
    setPhase("done");
  };

  const termLabel = briefing.keyTerm.term.includes(" ") ? "phrase" : "word";

  return (
    <main className="screen session" id="main">
      <SessionTop step={STEP[phase]} total={4} label="session" />

      {phase === "understand" && (
        <section>
          <StepHeader eyebrow="Read" title={briefing.title} />
          <SourceLine source={briefing.source} kind={briefing.kind} />
          {briefing.sourceChanged && (
            <p className="notice warn" role="status">
              The source was edited after this summary was written — details may have changed.{" "}
              <button className="link inline" type="button" onClick={() => load(true)}>
                Refresh summary
              </button>
            </p>
          )}
          <BriefingView b={briefing} />
          <div className="actions sticky">
            <button className="primary" type="button" onClick={() => setPhase("recall")}>
              I'm ready — hide the briefing
            </button>
          </div>
        </section>
      )}

      {(phase === "recall" || phase === "retry") && (
        <section>
          <StepHeader eyebrow={SKILLS[exercise.skill].name} title={phase === "retry" ? "Try again" : "Explain it from memory"} />
          <p className="task">{task}</p>
          {phase === "retry" && last?.feedback?.retryFocus && <p className="focus-tip">Focus: {last.feedback.retryFocus}</p>}
          <ResponseCapture {...capture} label="Your explanation" submitLabel="Get feedback" onSubmit={(d) => void submitMain(d, phase === "retry")} />
          {s.error != null && (
            <ErrorNotice error={s.error} onRetry={() => void submitMain(null, phase === "retry")}>
              <button className="link" type="button" onClick={() => { s.setError(null); setPending(null); }}>
                Edit my answer
              </button>
            </ErrorNotice>
          )}
          <details
            className="peek"
            onToggle={(e) => {
              if ((e.target as HTMLDetailsElement).open) setPeeked(true);
            }}
          >
            <summary>{peeked ? "Briefing (this attempt is marked assisted)" : "Stuck? Peek at the briefing"}</summary>
            <BriefingView b={briefing} compact />
          </details>
        </section>
      )}

      {phase === "improve" && last?.feedback && (
        <section>
          <StepHeader eyebrow={SKILLS[exercise.skill].name} title="Your feedback" />
          <FeedbackPanel feedback={last.feedback} attempt={last} />
          {first && first.id !== last.id && <CompareAttempts first={first} second={last} />}
          <div className="actions sticky">
            <button className="primary" type="button" onClick={() => setPhase("apply")}>
              Continue
            </button>
            {retries < MAX_RETRIES && (
              <button className="secondary" type="button" onClick={() => setPhase("retry")}>
                Try again
              </button>
            )}
          </div>
        </section>
      )}

      {phase === "apply" && (
        <section>
          <StepHeader eyebrow="Optional" title="A colleague asks…" />
          <p className="question">“{briefing.followUpQuestion}”</p>
          {!followUpAnswer && !answeringFollowUp && (
            <div className="actions">
              <button className="primary" type="button" onClick={() => setAnsweringFollowUp(true)}>
                Answer it
              </button>
              <button className="secondary" type="button" onClick={() => setPhase("save")}>
                Skip
              </button>
            </div>
          )}
          {!followUpAnswer && answeringFollowUp && (
            <>
              <p className="hint">Lead with your answer, then give one reason.</p>
              <ResponseCapture {...capture} label="Your answer" submitLabel="Get feedback" onSubmit={(d) => void submitFollowUp(d)} />
              {s.error != null && <ErrorNotice error={s.error} onRetry={() => void submitFollowUp(null)} />}
              <button className="link" type="button" onClick={() => setPhase("save")}>
                Skip
              </button>
            </>
          )}
          {followUpAnswer?.feedback && (
            <>
              <FeedbackPanel feedback={followUpAnswer.feedback} attempt={followUpAnswer} />
              <div className="actions sticky">
                <button className="primary" type="button" onClick={() => setPhase("save")}>
                  Continue
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {phase === "save" && (
        <section>
          <StepHeader eyebrow="Last step" title="Remember one thing" />
          <p className="hint">We'll ask you about it again in a few days.</p>
          <fieldset className="options">
            <legend className="sr-only">What to save</legend>
            {(
              [
                ["idea", "The main idea"],
                ["phrase", `The ${termLabel} “${briefing.keyTerm.term}”`],
                ["skill", SKILLS[exercise.skill].name],
                ["none", "Nothing this time"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className={saveChoice === v ? "option on" : "option"}>
                <input type="radio" name="save" value={v} checked={saveChoice === v} onChange={() => setSaveChoice(v)} />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="actions sticky">
            <button className="primary" type="button" onClick={finishSession}>
              Finish session
            </button>
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="done" aria-live="polite">
          <div className="done-mark" aria-hidden="true">
            ✓
          </div>
          <h2>Session complete</h2>
          <p>
            You explained <strong>{briefing.title}</strong>
            {retries > 0 ? ` and improved it with ${retries === 1 ? "a retry" : "two retries"}` : ""}.
          </p>
          {saveMsg && <p className="hint">{saveMsg}</p>}
          <div className="actions">
            <a className="button primary" href={href({ name: "today" })}>
              Done
            </a>
            <a className="button secondary" href={href({ name: "talk", fromStoryId: storyId })}>
              Practice it as a talk
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
