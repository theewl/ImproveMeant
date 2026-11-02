import { useEffect, useState } from "react";
import type { Attempt, Briefing } from "../../shared/types";
import { fillPrompt, getExercise, pickLearnExercise, SKILLS } from "../../shared/curriculum";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { useSession } from "../lib/useSession";
import { uid } from "../lib/storage";
import { addReviewItem, buildReviewItem, type SaveChoice } from "../lib/state";
import { href } from "../lib/router";
import { ResponseCapture, type AttemptDraft } from "../components/ResponseCapture";
import { CompareAttempts, FeedbackPanel } from "../components/Feedback";
import { ErrorNotice, Loading, SourceLine, StepHeader, formatDate } from "../components/common";

type Phase = "understand" | "recall" | "improve" | "retry" | "apply" | "save" | "done";
const MAX_RETRIES = 2;

export function BriefingView({ b, compact = false }: { b: Briefing & { sourceChanged?: boolean }; compact?: boolean }) {
  return (
    <article className="briefing" aria-label="Briefing">
      {!compact && <h3>{b.title}</h3>}
      <SourceLine source={b.source} kind={b.kind} />
      {b.sourceChanged && (
        <p className="notice warn" role="status">
          The source has been edited since this briefing was written. Some details may have changed — check the original.
        </p>
      )}
      <p className="hint">
        {b.generatedBy === "curated"
          ? "Curated summary written for this app. Read the source for full detail."
          : `AI-generated summary of the source text (retrieved ${formatDate(b.source.retrievedAt)})${b.coverage === "partial" ? ", based on the first part of a long article" : ""}. Check the source before relying on details.`}
      </p>
      <ul className="points">
        {b.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {b.uncertainty && (
        <div className="callout">
          <h4>What's uncertain or disputed</h4>
          <p>{b.uncertainty}</p>
        </div>
      )}
      <div className="callout term">
        <h4>Useful {b.keyTerm.term.includes(" ") ? "phrase" : "word"}: “{b.keyTerm.term}”</h4>
        <p>{b.keyTerm.meaning}</p>
        {b.keyTerm.inContext && <blockquote>From the source: “{b.keyTerm.inContext}”</blockquote>}
        <p className="example">e.g. {b.keyTerm.exampleUse}</p>
      </div>
      {b.supportingExcerpts.length > 0 && (
        <details>
          <summary>Source excerpts behind this briefing</summary>
          <ul>
            {b.supportingExcerpts.map((e) => (
              <li key={e}>
                <q>{e}</q>
              </li>
            ))}
          </ul>
          <p className="hint">Excerpts are checked automatically against the source text. {b.source.byline ? `Source text by ${b.source.byline}.` : ""}</p>
        </details>
      )}
    </article>
  );
}

export function LearnSession({ storyId }: { storyId: string }) {
  const { data, update, status } = useApp();
  const completedLearn = data.sessions.filter((s) => s.mode === "learn" && s.completedAt).length;
  const [briefing, setBriefing] = useState<(Briefing & { sourceChanged: boolean }) | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [phase, setPhase] = useState<Phase>("understand");
  const [peeked, setPeeked] = useState(false);
  const [pending, setPending] = useState<Attempt | null>(null);
  const [saveChoice, setSaveChoice] = useState<SaveChoice | "none">("idea");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [answeringFollowUp, setAnsweringFollowUp] = useState(false);
  const exercise = pickLearnExercise(completedLearn);
  const followUpExercise = getExercise("fu-answer-directly");

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
        s.setSession((x) => ({ ...x, storyTitle: b.title, storySource: b.source }));
      })
      .catch(setLoadError);
  };
  useEffect(() => load(), [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loadError) {
    return (
      <main className="screen" id="main">
        <h2>Couldn't open this story</h2>
        <ErrorNotice error={loadError} onRetry={() => load()}>
          <a className="button secondary" href={href({ name: "today" })}>
            Choose another story
          </a>
        </ErrorNotice>
      </main>
    );
  }
  if (!briefing) {
    return (
      <main className="screen" id="main">
        <Loading label="Preparing your briefing…" />
      </main>
    );
  }

  const task = fillPrompt(exercise.prompt, { topic: briefing.title });
  const mainAttempts = s.session.attempts.filter((a) => !s.session.followUps.some((f) => f.answer?.id === a.id));
  const last = mainAttempts[mainAttempts.length - 1];
  const first = mainAttempts[0];
  const retries = mainAttempts.filter((a) => a.isRetry).length;
  const maxChars = status?.maxResponseChars ?? 6000;
  const transcriptionAvailable = status?.transcription === "deepgram";

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
      setSaveMsg(added ? `Saved for review on ${formatDate(item.dueAt)}.` : "This was already in your reviews (or your review list is full), so nothing new was added.");
    }
    s.finish();
    setPhase("done");
  };

  return (
    <main className="screen" id="main">
      <p className="crumb">
        <a href={href({ name: "today" })}>Today</a> / Learn &amp; Explain
      </p>

      {phase === "understand" && (
        <section>
          <StepHeader step={1} total={4} title="Understand" />
          <BriefingView b={briefing} />
          <div className="actions">
            <button className="primary" type="button" onClick={() => setPhase("recall")}>
              I'm ready — hide the briefing
            </button>
            <a className="link" href={href({ name: "talk", fromStoryId: storyId })}>
              Turn this into a talk instead
            </a>
            {briefing.sourceChanged && (
              <button className="link" type="button" onClick={() => load(true)}>
                Refresh briefing from the updated source
              </button>
            )}
          </div>
        </section>
      )}

      {(phase === "recall" || phase === "retry") && (
        <section>
          <StepHeader step={2} total={4} title={phase === "retry" ? "Try again" : "Explain it from memory"} />
          <p className="task">{task}</p>
          <p className="hint">Skill: {SKILLS[exercise.skill].name}. Goal: {exercise.successDefinition}</p>
          {phase === "retry" && last?.feedback?.retryFocus && <p className="callout">Focus: {last.feedback.retryFocus}</p>}
          <details
            className="peek"
            onToggle={(e) => {
              if ((e.target as HTMLDetailsElement).open) setPeeked(true);
            }}
          >
            <summary>Reopen the briefing{peeked ? " (this attempt is marked assisted)" : ""}</summary>
            <p className="hint">Looking marks this attempt as assisted rather than recalled from memory. That's fine — it's tracked separately.</p>
            <BriefingView b={briefing} compact />
          </details>
          <ResponseCapture
            label="Your explanation"
            transcriptionAvailable={transcriptionAvailable}
            transcriptionConsent={data.transcriptionConsent}
            onConsent={() => update((d) => ({ ...d, transcriptionConsent: true }))}
            maxChars={maxChars}
            busy={s.busy}
            submitLabel="Get feedback"
            onSubmit={(d) => void submitMain(d, phase === "retry")}
          />
          {s.error != null && (
            <ErrorNotice error={s.error} onRetry={() => void submitMain(null, phase === "retry")}>
              <button className="link" type="button" onClick={() => { s.setError(null); setPending(null); }}>
                Edit my answer
              </button>
            </ErrorNotice>
          )}
        </section>
      )}

      {phase === "improve" && last?.feedback && (
        <section>
          <StepHeader step={3} total={4} title="Improve" />
          <FeedbackPanel feedback={last.feedback} attempt={last} />
          {first && last && first.id !== last.id && <CompareAttempts first={first} second={last} />}
          <div className="actions">
            <button className="primary" type="button" onClick={() => setPhase("apply")}>
              Continue
            </button>
            {retries < MAX_RETRIES && (
              <button className="secondary" type="button" onClick={() => setPhase("retry")}>
                Retry{last.feedback.retryFocus ? " with this focus" : ""}
              </button>
            )}
          </div>
        </section>
      )}

      {phase === "apply" && (
        <section>
          <StepHeader step={4} total={4} title="Apply it, or finish" />
          <div className="callout">
            <h4>A colleague asks:</h4>
            <p className="question">“{briefing.followUpQuestion}”</p>
          </div>
          {!followUpAnswer && !answeringFollowUp && (
            <div className="actions">
              <button className="primary" type="button" onClick={() => setPhase("save")}>
                Finish here
              </button>
              <button className="secondary" type="button" onClick={() => setAnsweringFollowUp(true)}>
                Answer the question (optional)
              </button>
            </div>
          )}
          {!followUpAnswer && answeringFollowUp && (
            <>
              <p className="hint">Goal: {followUpExercise.successDefinition}</p>
              <ResponseCapture
                label="Your answer"
                transcriptionAvailable={transcriptionAvailable}
                transcriptionConsent={data.transcriptionConsent}
                onConsent={() => update((d) => ({ ...d, transcriptionConsent: true }))}
                maxChars={maxChars}
                busy={s.busy}
                submitLabel="Get feedback"
                onSubmit={(d) => void submitFollowUp(d)}
              />
              {s.error != null && <ErrorNotice error={s.error} onRetry={() => void submitFollowUp(null)} />}
            </>
          )}
          {followUpAnswer?.feedback && (
            <>
              <FeedbackPanel feedback={followUpAnswer.feedback} attempt={followUpAnswer} />
              <div className="actions">
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
          <h2>Save one thing for later</h2>
          <p className="hint">You'll be asked to recall it in a few days, in a different way.</p>
          <fieldset className="choices">
            <legend className="sr-only">What to save</legend>
            {(
              [
                ["idea", `The main idea of “${briefing.title}”`],
                ["phrase", `The ${briefing.keyTerm.term.includes(" ") ? "phrase" : "word"} “${briefing.keyTerm.term}”`],
                ["skill", `The skill: ${SKILLS[exercise.skill].name}`],
                ["none", "Nothing this time"],
              ] as const
            ).map(([v, label]) => (
              <label key={v} className="choice">
                <input type="radio" name="save" value={v} checked={saveChoice === v} onChange={() => setSaveChoice(v)} />
                {label}
              </label>
            ))}
          </fieldset>
          {briefing.kind === "current" && saveChoice === "idea" && (
            <p className="hint">News changes. This will be reviewed as “as reported on {formatDate(briefing.source.publishedAt)}”, and flagged if the source is edited.</p>
          )}
          <div className="actions">
            <button className="primary" type="button" onClick={finishSession}>
              Finish session
            </button>
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="done" aria-live="polite">
          <h2 tabIndex={-1}>Session complete</h2>
          <p>
            You explained <strong>{briefing.title}</strong> {first?.modality === "spoken" ? "out loud" : "in writing"}
            {retries > 0 ? ` and retried ${retries === 1 ? "once" : "twice"}` : ""}.
          </p>
          <p>Skill practiced: {SKILLS[exercise.skill].name}.</p>
          {first?.assisted && <p className="hint">Your first attempt was assisted (you reopened the briefing).</p>}
          {saveMsg && <p>{saveMsg}</p>}
          <p className="hint">Want to use it for real? Try explaining this idea to someone today — you can log it under Progress.</p>
          <div className="actions">
            <a className="button primary" href={href({ name: "today" })}>
              Back to today
            </a>
            <a className="button secondary" href={href({ name: "talk", fromStoryId: storyId })}>
              Practice it as a short talk
            </a>
          </div>
        </section>
      )}
    </main>
  );
}
