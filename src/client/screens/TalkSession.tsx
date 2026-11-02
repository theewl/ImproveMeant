import { useEffect, useRef, useState } from "react";
import type { Attempt, AudienceQuestion, Briefing, ScenarioId, TalkSetup } from "../../shared/types";
import { SCENARIOS, SKILLS, fillPrompt, getExercise, getScenario } from "../../shared/curriculum";
import { formatSeconds } from "../../shared/observations";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { useSession } from "../lib/useSession";
import { uid } from "../lib/storage";
import { addReviewItem, buildReviewItem } from "../lib/state";
import { href } from "../lib/router";
import { ResponseCapture, type AttemptDraft } from "../components/ResponseCapture";
import { CompareAttempts, FeedbackPanel } from "../components/Feedback";
import { ErrorNotice, Loading, StepHeader, formatDate } from "../components/common";

type Phase = "setup" | "prepare" | "present" | "question" | "feedback" | "second-question" | "finish" | "done";
const MAX_RETRIES = 2;

function defaultSetup(id: ScenarioId, fromStoryId?: string): TalkSetup {
  const sc = getScenario(id);
  return {
    scenarioId: id,
    audience: sc.defaultAudience,
    audienceKnowledge: "some-familiarity",
    outcome: sc.defaultOutcome,
    topic: "",
    notes: "",
    targetSeconds: 120,
    questionStyle: "supportive",
    fromStoryId,
  };
}

export function TalkSession({ fromStoryId }: { fromStoryId?: string }) {
  const { data, update, status } = useApp();
  const [setup, setSetup] = useState<TalkSetup>(() => defaultSetup(fromStoryId ? "explain-group" : "propose-change", fromStoryId));
  const [phase, setPhase] = useState<Phase>("setup");
  const [story, setStory] = useState<Briefing | null>(null);
  const [pending, setPending] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<unknown>(null);
  const [answers, setAnswers] = useState<Attempt[]>([]);
  const [isRetry, setIsRetry] = useState(false);
  const [saveSkill, setSaveSkill] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const qKey = useRef(uid("q-"));

  const scenario = getScenario(setup.scenarioId);
  const exercise = getExercise(scenario.exerciseId);

  const s = useSession(() => ({
    id: uid("s-"),
    mode: "talk",
    startedAt: new Date().toISOString(),
    storyId: fromStoryId,
    exerciseId: exercise.id,
    skill: exercise.skill,
    attempts: [],
    followUps: [],
    usedLive: false,
  }));

  useEffect(() => {
    if (!fromStoryId) return;
    api
      .briefing(fromStoryId)
      .then((b) => {
        setStory(b);
        setSetup((x) => ({ ...x, topic: x.topic || b.title, notes: x.notes || `Main idea: ${b.mainIdea}` }));
      })
      .catch(() => setStory(null));
  }, [fromStoryId]);

  useEffect(() => {
    s.setSession((x) => ({ ...x, exerciseId: exercise.id, skill: exercise.skill, talk: setup, storyTitle: story?.title, storySource: story?.source }));
  }, [setup, exercise.id, exercise.skill, story]); // eslint-disable-line react-hooks/exhaustive-deps

  const maxChars = status?.maxResponseChars ?? 6000;
  const transcriptionAvailable = status?.transcription === "deepgram";
  const talkAttempts = s.session.attempts.filter((a) => !answers.some((x) => x.id === a.id));
  const first = talkAttempts[0];
  const last = talkAttempts[talkAttempts.length - 1];
  const retries = talkAttempts.filter((a) => a.isRetry).length;
  const task = fillPrompt(exercise.prompt, { topic: setup.topic, audience: setup.audience });

  const captureProps = {
    transcriptionAvailable,
    transcriptionConsent: data.transcriptionConsent,
    onConsent: () => update((d) => ({ ...d, transcriptionConsent: true })),
    maxChars,
    busy: s.busy,
  };

  // --- Talk attempt ---
  const submitTalk = async (draft: AttemptDraft) => {
    const attempt = await s.makeAttempt(draft, { isRetry, assisted: false });
    if (isRetry) {
      setPending(attempt);
      await requestTalkFeedback(attempt, null);
    } else {
      setPending(attempt);
      setPhase("question");
      void askQuestion(attempt.text, []);
    }
  };

  const askQuestion = async (talkText: string, previous: string[]) => {
    setQLoading(true);
    setQError(null);
    try {
      const q = await api.audienceQuestion({ idempotencyKey: qKey.current + previous.length, talk: setup, response: talkText, previousQuestions: previous });
      setQuestions((qs) => [...qs, q]);
    } catch (e) {
      setQError(e);
    } finally {
      setQLoading(false);
    }
  };

  const requestTalkFeedback = async (attempt: Attempt, followUp: { question: string; answer: string } | null): Promise<boolean> => {
    const prev = attempt.isRetry ? last : undefined;
    const fb = await s.getFeedback(attempt, {
      exerciseId: exercise.id,
      mode: "talk",
      talk: setup,
      storyId: fromStoryId,
      previous: prev ? { text: prev.text, retryFocus: prev.feedback?.retryFocus ?? null } : null,
      followUp,
    });
    if (!fb) return false;
    s.addAttempt({ ...attempt, feedback: fb });
    setPending(null);
    setPhase("feedback");
    return true;
  };

  // --- Answer to first question: then feedback on talk + answer together ---
  const [pendingAnswer, setPendingAnswer] = useState<Attempt | null>(null);
  const submitAnswer = async (draft: AttemptDraft | null) => {
    const q = questions[0];
    if (!q || !pending) return;
    const ans = pendingAnswer ?? (draft ? await s.makeAttempt(draft, { isRetry: false, assisted: false }) : null);
    if (!ans) return;
    setPendingAnswer(ans);
    const ok = await requestTalkFeedback(pending, { question: q.question, answer: ans.text });
    if (ok) {
      setAnswers((a) => [...a, ans]);
      s.setSession((x) => ({ ...x, attempts: [...x.attempts.filter((y) => y.id !== ans.id), ans], followUps: [...x.followUps, { question: q, answer: ans }] }));
      setPendingAnswer(null);
    }
  };

  const skipQuestion = async () => {
    if (!pending) return;
    await requestTalkFeedback(pending, null);
  };

  // --- Optional second question ---
  const submitSecondAnswer = async (draft: AttemptDraft | null) => {
    const q = questions[1];
    if (!q) return;
    const ans = pendingAnswer ?? (draft ? await s.makeAttempt(draft, { isRetry: false, assisted: false }) : null);
    if (!ans) return;
    setPendingAnswer(ans);
    const fb = await s.getFeedback(ans, {
      exerciseId: "fu-answer-directly",
      mode: "talk",
      target: "followup",
      talk: setup,
      followUp: { question: q.question, answer: ans.text },
    });
    if (!fb) return;
    const answered = { ...ans, feedback: fb };
    setAnswers((a) => [...a, answered]);
    s.setSession((x) => ({ ...x, attempts: [...x.attempts, answered], followUps: [...x.followUps, { question: q, answer: answered }] }));
    setPendingAnswer(null);
  };

  const finishSession = () => {
    if (saveSkill) {
      const item = buildReviewItem("skill", { exerciseId: exercise.id, skill: exercise.skill }, new Date().toISOString());
      const { added } = addReviewItem(data, item);
      if (added) update((d) => addReviewItem(d, item).data);
      setSaveMsg(added ? `Skill saved — you'll apply it in a new situation on ${formatDate(item.dueAt)}.` : "This skill is already in your reviews.");
    }
    s.finish();
    setPhase("done");
  };

  const secondAnswer = questions[1] ? s.session.followUps.find((f) => f.question.question === questions[1]!.question)?.answer : undefined;

  return (
    <main className={phase === "present" ? "screen presenting" : "screen"} id="main">
      {phase !== "present" && (
        <p className="crumb">
          <a href={href({ name: "today" })}>Today</a> / Rehearse a talk
        </p>
      )}

      {phase === "setup" && (
        <section>
          <StepHeader step={1} total={4} title="Set up your talk" />
          <p className="notice">The audience in this rehearsal is simulated by the app. Its questions are practice, not real reactions.</p>
          {story && <p className="hint">Based on: {story.title}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!setup.topic.trim()) return;
              setPhase("prepare");
            }}
          >
            <fieldset className="choices scenarios">
              <legend className="label">Scenario</legend>
              {SCENARIOS.map((sc) => (
                <label key={sc.id} className={setup.scenarioId === sc.id ? "choice card-choice on" : "choice card-choice"}>
                  <input
                    type="radio"
                    name="scenario"
                    value={sc.id}
                    checked={setup.scenarioId === sc.id}
                    onChange={() => setSetup((x) => ({ ...defaultSetup(sc.id, fromStoryId), topic: x.topic, notes: x.notes, targetSeconds: x.targetSeconds, questionStyle: x.questionStyle }))}
                  />
                  <span>
                    <strong>{sc.title}</strong>
                    <span className="hint block">{sc.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="label" htmlFor="topic">
              {setup.scenarioId === "propose-change" ? "The change you'll propose" : setup.scenarioId === "introduce" ? "Context (e.g. first team meeting)" : "Topic"}
            </label>
            <input id="topic" value={setup.topic} maxLength={300} required onChange={(e) => setSetup({ ...setup, topic: e.target.value })} />
            <label className="label" htmlFor="audience">
              Audience
            </label>
            <input id="audience" value={setup.audience} maxLength={200} onChange={(e) => setSetup({ ...setup, audience: e.target.value })} />
            <label className="label" htmlFor="knowledge">
              What they already know
            </label>
            <select id="knowledge" value={setup.audienceKnowledge} onChange={(e) => setSetup({ ...setup, audienceKnowledge: e.target.value as TalkSetup["audienceKnowledge"] })}>
              <option value="new-to-topic">New to the topic</option>
              <option value="some-familiarity">Some familiarity</option>
              <option value="experts">Experts</option>
            </select>
            <label className="label" htmlFor="outcome">
              What you want to happen afterwards
            </label>
            <input id="outcome" value={setup.outcome} maxLength={200} onChange={(e) => setSetup({ ...setup, outcome: e.target.value })} />
            <label className="label" htmlFor="notes">
              Notes or bullet points (optional)
            </label>
            <textarea id="notes" rows={3} maxLength={1500} value={setup.notes} onChange={(e) => setSetup({ ...setup, notes: e.target.value })} />
            <fieldset className="choices inline">
              <legend className="label">Target length</legend>
              {([60, 120, 180] as const).map((t) => (
                <label key={t} className="choice">
                  <input type="radio" name="target" checked={setup.targetSeconds === t} onChange={() => setSetup({ ...setup, targetSeconds: t })} />
                  {t / 60} min
                </label>
              ))}
            </fieldset>
            <fieldset className="choices inline">
              <legend className="label">Audience questions</legend>
              {(["supportive", "challenging"] as const).map((q) => (
                <label key={q} className="choice">
                  <input type="radio" name="qstyle" checked={setup.questionStyle === q} onChange={() => setSetup({ ...setup, questionStyle: q })} />
                  {q === "supportive" ? "Supportive" : "Challenging"}
                </label>
              ))}
            </fieldset>
            <div className="actions">
              <button className="primary" type="submit" disabled={!setup.topic.trim()}>
                Continue
              </button>
            </div>
          </form>
        </section>
      )}

      {phase === "prepare" && (
        <Prepare
          setup={setup}
          task={task}
          skillName={SKILLS[exercise.skill].name}
          success={exercise.successDefinition}
          retryFocus={isRetry ? last?.feedback?.retryFocus ?? null : null}
          onReady={() => setPhase("present")}
        />
      )}

      {phase === "present" && (
        <section aria-label="Presentation" className="present">
          <p className="present-audience">
            Speaking to <strong>{setup.audience}</strong> (simulated) · target {formatSeconds(setup.targetSeconds)} — finish whenever you're done
          </p>
          <p className="present-task">{task}</p>
          {setup.notes.trim() && (
            <details>
              <summary>My notes</summary>
              <p className="notes">{setup.notes}</p>
            </details>
          )}
          <ResponseCapture
            {...captureProps}
            label="Your talk"
            submitLabel={isRetry ? "Get feedback" : "Continue"}
            focused
            targetSeconds={setup.targetSeconds}
            defaultModality="spoken"
            onSubmit={(d) => void submitTalk(d)}
          />
          {s.error != null && pending && <ErrorNotice error={s.error} onRetry={() => void requestTalkFeedback(pending, null)} />}
          <button className="link" type="button" onClick={() => setPhase("prepare")}>
            Back to preparation
          </button>
        </section>
      )}

      {phase === "question" && (
        <section>
          <StepHeader step={3} total={4} title="Audience question" />
          {qLoading && <Loading label="The audience is thinking of a question…" />}
          {qError != null && (
            <ErrorNotice error={qError} onRetry={() => pending && void askQuestion(pending.text, [])}>
              <button className="link" type="button" onClick={() => void skipQuestion()}>
                Skip the question and get feedback
              </button>
            </ErrorNotice>
          )}
          {questions[0] && (
            <>
              <QuestionCard q={questions[0]} audience={setup.audience} />
              <ResponseCapture {...captureProps} label="Your answer" submitLabel="Get feedback" onSubmit={(d) => void submitAnswer(d)} />
              {s.error != null && <ErrorNotice error={s.error} onRetry={() => void submitAnswer(null)} />}
              <button className="link" type="button" disabled={s.busy} onClick={() => void skipQuestion()}>
                Skip the question
              </button>
            </>
          )}
        </section>
      )}

      {phase === "feedback" && last?.feedback && (
        <section>
          <StepHeader step={4} total={4} title="Feedback" />
          <FeedbackPanel feedback={last.feedback} attempt={last} />
          {first && first.id !== last.id && <CompareAttempts first={first} second={last} />}
          {questions[1] && <SecondQuestion q={questions[1]} audience={setup.audience} answer={secondAnswer} captureProps={captureProps} error={s.error} onSubmit={submitSecondAnswer} />}
          <div className="actions">
            <button className="primary" type="button" onClick={() => setPhase("finish")}>
              Finish
            </button>
            {retries < MAX_RETRIES && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setIsRetry(true);
                  s.setError(null);
                  setPhase("prepare");
                }}
              >
                Retry the talk
              </button>
            )}
            {!questions[1] && questions[0] && (
              <button className="secondary" type="button" disabled={qLoading} onClick={() => first && void askQuestion(first.text, questions.map((q) => q.question))}>
                {qLoading ? "Thinking…" : "Take one more question"}
              </button>
            )}
          </div>
          {qError != null && phase === "feedback" && <ErrorNotice error={qError} />}
        </section>
      )}

      {phase === "finish" && (
        <section>
          <h2>Wrap up</h2>
          <label className="choice">
            <input type="checkbox" checked={saveSkill} onChange={(e) => setSaveSkill(e.target.checked)} />
            Save “{SKILLS[exercise.skill].name}” to practise later in a different situation
          </label>
          <div className="actions">
            <button className="primary" type="button" onClick={finishSession}>
              Finish session
            </button>
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="done" aria-live="polite">
          <h2>Rehearsal complete</h2>
          <p>
            You gave a {first?.modality === "spoken" ? "spoken" : "written"} {scenario.title.toLowerCase()} talk for {setup.audience}
            {first?.durationSeconds ? ` (${formatSeconds(first.durationSeconds)})` : ""}
            {retries ? `, with ${retries} retr${retries === 1 ? "y" : "ies"}` : ""}.
          </p>
          {saveMsg && <p>{saveMsg}</p>}
          <p className="hint">Next real meeting: try opening with your main point. You can log how it went under Progress.</p>
          <div className="actions">
            <a className="button primary" href={href({ name: "today" })}>
              Back to today
            </a>
          </div>
        </section>
      )}
    </main>
  );
}

function QuestionCard({ q, audience }: { q: AudienceQuestion; audience: string }) {
  return (
    <div className="callout question-card">
      <p className="hint">
        Simulated audience member ({audience}){q.kind === "sample" ? " · sample question from the practice bank, not generated from your talk" : ""}
      </p>
      <p className="question">“{q.question}”</p>
    </div>
  );
}

function SecondQuestion({
  q,
  audience,
  answer,
  captureProps,
  error,
  onSubmit,
}: {
  q: AudienceQuestion;
  audience: string;
  answer?: Attempt;
  captureProps: Omit<Parameters<typeof ResponseCapture>[0], "label" | "submitLabel" | "onSubmit">;
  error: unknown;
  onSubmit: (d: AttemptDraft | null) => Promise<void>;
}) {
  return (
    <section className="card" aria-label="Second question">
      <QuestionCard q={q} audience={audience} />
      {answer?.feedback ? (
        <FeedbackPanel feedback={answer.feedback} attempt={answer} />
      ) : (
        <>
          <ResponseCapture {...captureProps} label="Your answer" submitLabel="Get feedback" onSubmit={(d) => void onSubmit(d)} />
          {error != null && <ErrorNotice error={error} onRetry={() => void onSubmit(null)} />}
        </>
      )}
    </section>
  );
}

function Prepare({ setup, task, skillName, success, retryFocus, onReady }: { setup: TalkSetup; task: string; skillName: string; success: string; retryFocus: string | null; onReady: () => void }) {
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  useEffect(() => {
    if (prepLeft == null || prepLeft <= 0) return;
    const t = window.setTimeout(() => setPrepLeft((x) => (x == null ? x : x - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [prepLeft]);
  return (
    <section>
      <StepHeader step={2} total={4} title={retryFocus ? "Prepare your retry" : "Prepare (optional)"} />
      <div className="card">
        <p className="task">{task}</p>
        <p className="hint">
          Skill: {skillName}. Success: {success}
        </p>
        {retryFocus && <p className="callout">Focus for this retry: {retryFocus}</p>}
        <dl className="setup-summary">
          <dt>Audience</dt>
          <dd>
            {setup.audience} ({setup.audienceKnowledge.replaceAll("-", " ")})
          </dd>
          <dt>Desired outcome</dt>
          <dd>{setup.outcome}</dd>
          <dt>Target</dt>
          <dd>{setup.targetSeconds / 60} min — you won't be cut off</dd>
        </dl>
        {setup.notes.trim() && <p className="notes">{setup.notes}</p>}
      </div>
      <div className="actions">
        <button className="primary" type="button" onClick={onReady}>
          I'm ready to present
        </button>
        {prepLeft == null ? (
          <button className="secondary" type="button" onClick={() => setPrepLeft(60)}>
            Give me 60 seconds to prepare
          </button>
        ) : (
          <p className="timer small" role="timer" aria-live="off">
            {prepLeft > 0 ? `Preparation: ${formatSeconds(prepLeft)}` : "Preparation time's up — start when ready."}
          </p>
        )}
      </div>
    </section>
  );
}
