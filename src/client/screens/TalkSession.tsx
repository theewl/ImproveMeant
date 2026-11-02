import { useEffect, useRef, useState } from "react";
import type { Attempt, AudienceQuestion, Briefing, Experiment, ScenarioId, TalkSetup } from "../../shared/types";
import { OUTWARD_FOCUS_TIP, SAFETY_BEHAVIOURS } from "../../shared/confidence";
import { SCENARIOS, SKILLS, fillPrompt, getExercise, getScenario } from "../../shared/curriculum";
import { formatSeconds } from "../../shared/observations";
import { api } from "../lib/api";
import { useApp } from "../lib/store";
import { useSession } from "../lib/useSession";
import { uid } from "../lib/storage";
import { addReviewItem, buildReviewItem } from "../lib/state";
import { href } from "../lib/router";
import { ResponseCapture, type AttemptDraft } from "../components/ResponseCapture";
import { CompareAttempts, FeedbackPanel, WrapUp } from "../components/Feedback";
import { ErrorNotice, Loading, SessionTop, StepHeader, formatDate, useFocusMode } from "../components/common";

type Phase = "scenario" | "setup" | "prepare" | "present" | "question" | "feedback" | "finish" | "done";
const TALK_STEP: Record<Phase, number> = { scenario: 1, setup: 1, prepare: 2, present: 2, question: 3, feedback: 4, finish: 4, done: 4 };
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

export function TalkSession({ fromStoryId, scenario: initialScenario }: { fromStoryId?: string; scenario?: ScenarioId }) {
  const { data, update, status } = useApp();
  const [setup, setSetup] = useState<TalkSetup>(() => defaultSetup(initialScenario ?? (fromStoryId ? "explain-group" : "propose-change"), fromStoryId));
  const [phase, setPhase] = useState<Phase>(fromStoryId || initialScenario ? "setup" : "scenario");
  useFocusMode(phase !== "scenario");
  const [story, setStory] = useState<Briefing | null>(null);
  const [pending, setPending] = useState<Attempt | null>(null);
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState<unknown>(null);
  const [answers, setAnswers] = useState<Attempt[]>([]);
  const [isRetry, setIsRetry] = useState(false);
  const [saveSkill, setSaveSkill] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [checkinSaved, setCheckinSaved] = useState(false);
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
    <main className={phase === "present" ? "screen session presenting" : "screen session"} id="main">
      {phase !== "scenario" && <SessionTop step={TALK_STEP[phase]} total={4} label="rehearsal" />}

      {phase === "scenario" && (
        <section>
          <StepHeader eyebrow="Rehearse a talk" title="What are you practising?" />
          <ul className="scenario-list">
            {SCENARIOS.map((sc) => (
              <li key={sc.id}>
                <button
                  type="button"
                  className="scenario"
                  onClick={() => {
                    setSetup((x) => ({ ...defaultSetup(sc.id, fromStoryId), topic: x.topic, notes: x.notes, targetSeconds: x.targetSeconds, questionStyle: x.questionStyle }));
                    setPhase("setup");
                  }}
                >
                  <strong>{sc.title}</strong>
                  <span>{sc.description}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="hint">You'll speak to a simulated audience that asks you a question afterwards.</p>
        </section>
      )}

      {phase === "setup" && (
        <section>
          <StepHeader eyebrow={scenario.title} title="Set up your talk" />
          {story && <p className="hint">Based on: {story.title}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!setup.topic.trim()) return;
              setPhase("prepare");
            }}
          >
            <label className="label" htmlFor="topic">
              {setup.scenarioId === "propose-change" ? "The change you'll propose" : setup.scenarioId === "introduce" ? "Where you're introducing yourself" : "Topic"}
            </label>
            <input id="topic" value={setup.topic} maxLength={300} required onChange={(e) => setSetup({ ...setup, topic: e.target.value })} />
            <label className="label" htmlFor="audience">
              Who's listening
            </label>
            <input id="audience" value={setup.audience} maxLength={200} onChange={(e) => setSetup({ ...setup, audience: e.target.value })} />
            <fieldset className="pills">
              <legend className="label">Length</legend>
              {([60, 120, 180] as const).map((t) => (
                <label key={t} className={setup.targetSeconds === t ? "pill on" : "pill"}>
                  <input type="radio" name="target" checked={setup.targetSeconds === t} onChange={() => setSetup({ ...setup, targetSeconds: t })} />
                  {t / 60} min
                </label>
              ))}
            </fieldset>
            <details className="more">
              <summary>More options</summary>
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
                Notes (optional)
              </label>
              <textarea id="notes" rows={3} maxLength={1500} value={setup.notes} onChange={(e) => setSetup({ ...setup, notes: e.target.value })} />
              <fieldset className="pills">
                <legend className="label">Audience questions</legend>
                {(["supportive", "challenging"] as const).map((q) => (
                  <label key={q} className={setup.questionStyle === q ? "pill on" : "pill"}>
                    <input type="radio" name="qstyle" checked={setup.questionStyle === q} onChange={() => setSetup({ ...setup, questionStyle: q })} />
                    {q === "supportive" ? "Supportive" : "Challenging"}
                  </label>
                ))}
              </fieldset>
            </details>
            <div className="actions sticky">
              <button className="primary" type="submit" disabled={!setup.topic.trim()}>
                Continue
              </button>
              {!fromStoryId && (
                <button className="link" type="button" onClick={() => setPhase("scenario")}>
                  Change scenario
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {phase === "prepare" && (
        <Prepare
          setup={setup}
          task={task}
          retryFocus={isRetry ? last?.feedback?.retryFocus ?? null : null}
          showCheckin={!isRetry}
          onReady={(c) => {
            if (c) setCheckin(c);
            setPhase("present");
          }}
        />
      )}

      {phase === "present" && (
        <section aria-label="Presentation" className="present">
          <p className="present-audience">
            To {setup.audience} <span className="sim">simulated</span> · aim for {formatSeconds(setup.targetSeconds)}
          </p>
          <p className="present-task">{task}</p>
          {checkin?.drop === "Holding notes the whole time" && setup.notes.trim() && <p className="hint">Notes hidden — you chose to try without them.</p>}
          {setup.notes.trim() && checkin?.drop !== "Holding notes the whole time" && (
            <details className="more">
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
        </section>
      )}

      {phase === "question" && (
        <section>
          <StepHeader eyebrow="Q&A" title="A question from the audience" />
          {qLoading && <Loading label="The audience is thinking…" />}
          {qError != null && (
            <ErrorNotice error={qError} onRetry={() => pending && void askQuestion(pending.text, [])}>
              <button className="link" type="button" onClick={() => void skipQuestion()}>
                Skip to feedback
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
          <StepHeader eyebrow={SKILLS[exercise.skill].name} title="Your feedback" />
          <FeedbackPanel feedback={last.feedback} attempt={last} />
          {first && first.id !== last.id && <CompareAttempts first={first} second={last} />}
          {questions[1] && <SecondQuestion q={questions[1]} audience={setup.audience} answer={secondAnswer} captureProps={captureProps} error={s.error} onSubmit={submitSecondAnswer} />}
          <div className="actions sticky">
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
                Try again
              </button>
            )}
          </div>
          {!questions[1] && questions[0] && (
            <button className="link" type="button" disabled={qLoading} onClick={() => first && void askQuestion(first.text, questions.map((q) => q.question))}>
              {qLoading ? "Thinking…" : "Take one more question"}
            </button>
          )}
          {qError != null && <ErrorNotice error={qError} />}
        </section>
      )}

      {phase === "finish" && (
        <section>
          <StepHeader eyebrow="Last step" title="Practise this again later?" />
          <label className={saveSkill ? "option on" : "option"}>
            <input type="checkbox" checked={saveSkill} onChange={(e) => setSaveSkill(e.target.checked)} />
            Remind me to use “{SKILLS[exercise.skill].name}” in a new situation
          </label>
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
          <h2>Rehearsal complete</h2>
          <p>
            {scenario.title} for {setup.audience}
            {first?.durationSeconds ? ` · ${formatSeconds(first.durationSeconds)}` : ""}
            {retries ? ` · ${retries} retr${retries === 1 ? "y" : "ies"}` : ""}
          </p>
          {saveMsg && <p className="hint">{saveMsg}</p>}
          {checkin && !checkinSaved && (
            <AfterCheckin
              checkin={checkin}
              onSave={(anxietyAfter, outcome) => {
                const e: Experiment = {
                  id: uid("x-"),
                  createdAt: s.session.startedAt,
                  kind: "rehearsal",
                  sessionId: s.session.id,
                  situation: `Rehearsal: ${scenario.title}${setup.topic ? ` — ${setup.topic}` : ""}`,
                  prediction: checkin.prediction || "It would go badly",
                  predictionLikelihood: 50,
                  anxietyBefore: checkin.anxietyBefore,
                  safetyBehaviourToDrop: checkin.drop,
                  completedAt: new Date().toISOString(),
                  anxietyAfter,
                  outcome,
                };
                update((d) => ({ ...d, experiments: [...d.experiments, e] }));
                setCheckinSaved(true);
              }}
            />
          )}
          {checkinSaved && <p className="notice ok">Saved to Confidence.</p>}
          <WrapUp attempts={s.session.attempts} />
          <p className="hint">In your next real meeting, try opening with your main point.</p>
          <div className="actions">
            <a className="button primary" href={href({ name: "today" })}>
              Done
            </a>
          </div>
        </section>
      )}
    </main>
  );
}

function QuestionCard({ q, audience }: { q: AudienceQuestion; audience: string }) {
  return (
    <div className="question-card">
      <p className="eyebrow">
        Simulated audience member · {audience}
      </p>
      <p className="question">“{q.question}”</p>
      {q.kind === "sample" && <p className="hint">Demo: sample question from the practice bank, not based on your talk.</p>}
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
    <section className="second-q" aria-label="Second question">
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

interface Checkin {
  anxietyBefore: number;
  prediction: string;
  drop?: string;
}

function AfterCheckin({ checkin, onSave }: { checkin: Checkin; onSave: (anxietyAfter: number, outcome: NonNullable<Experiment["outcome"]>) => void }) {
  const [after, setAfter] = useState(checkin.anxietyBefore);
  const [outcome, setOutcome] = useState<Experiment["outcome"]>();
  return (
    <form
      className="checkin-after"
      onSubmit={(e) => {
        e.preventDefault();
        if (outcome) onSave(after, outcome);
      }}
    >
      <p className="eyebrow">Before, you felt {checkin.anxietyBefore}/10{checkin.prediction ? ` and worried: “${checkin.prediction}”` : ""}</p>
      <div className="slider-head">
        <label className="label" htmlFor="after-anx">
          How anxious did you feel while speaking?
        </label>
        <output htmlFor="after-anx">{after}/10</output>
      </div>
      <input id="after-anx" type="range" min={0} max={10} value={after} onChange={(e) => setAfter(Number(e.target.value))} />
      <fieldset className="pills">
        <legend className="label">Did what you worried about happen?</legend>
        {(
          [
            ["didnt-happen", "No"],
            ["partly", "Partly"],
            ["happened", "Yes"],
          ] as const
        ).map(([v, l]) => (
          <label key={v} className={outcome === v ? "pill on" : "pill"}>
            <input type="radio" name="after-outcome" checked={outcome === v} onChange={() => setOutcome(v)} />
            {l}
          </label>
        ))}
      </fieldset>
      <button className="secondary" type="submit" disabled={!outcome}>
        Save check-in
      </button>
    </form>
  );
}

function Prepare({
  setup,
  task,
  retryFocus,
  showCheckin,
  onReady,
}: {
  setup: TalkSetup;
  task: string;
  retryFocus: string | null;
  showCheckin: boolean;
  onReady: (checkin: Checkin | null) => void;
}) {
  const [prepLeft, setPrepLeft] = useState<number | null>(null);
  const [useCheckin, setUseCheckin] = useState(false);
  const [anx, setAnx] = useState(5);
  const [prediction, setPrediction] = useState("");
  const [drop, setDrop] = useState<string | undefined>();
  useEffect(() => {
    if (prepLeft == null || prepLeft <= 0) return;
    const t = window.setTimeout(() => setPrepLeft((x) => (x == null ? x : x - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [prepLeft]);
  return (
    <section>
      <StepHeader eyebrow={retryFocus ? "Retry" : "Get ready"} title={retryFocus ? "Prepare your retry" : "Prepare (optional)"} />
      <p className="task">{task}</p>
      {retryFocus && <p className="focus-tip">Focus: {retryFocus}</p>}
      <p className="hint">
        About {setup.targetSeconds / 60} min. You won't be cut off.
      </p>
      {setup.notes.trim() && <p className="notes">{setup.notes}</p>}
      {prepLeft != null && (
        <p className="timer" role="timer" aria-live="off">
          {prepLeft > 0 ? formatSeconds(prepLeft) : "Time's up"}
        </p>
      )}
      {showCheckin && (
        <details className="more" onToggle={(e) => setUseCheckin((e.target as HTMLDetailsElement).open)}>
          <summary>Feeling nervous? Quick check-in</summary>
          <div className="slider-head">
            <label className="label" htmlFor="pre-anx">
              How anxious do you feel?
            </label>
            <output htmlFor="pre-anx">{anx}/10</output>
          </div>
          <input id="pre-anx" type="range" min={0} max={10} value={anx} onChange={(e) => setAnx(Number(e.target.value))} />
          <label className="label" htmlFor="pre-pred">
            What are you worried will happen? (optional)
          </label>
          <input id="pre-pred" value={prediction} maxLength={300} placeholder="e.g. I'll lose my thread halfway" onChange={(e) => setPrediction(e.target.value)} />
          <fieldset className="pills">
            <legend className="label">Optional: drop one habit this time</legend>
            {SAFETY_BEHAVIOURS.map((b) => (
              <label key={b} className={drop === b ? "pill on" : "pill"}>
                <input type="radio" name="pre-drop" checked={drop === b} onChange={() => setDrop(b)} onClick={() => drop === b && setDrop(undefined)} />
                {b}
              </label>
            ))}
          </fieldset>
          <p className="focus-tip">{OUTWARD_FOCUS_TIP}</p>
        </details>
      )}
      <div className="actions sticky">
        <button className="primary" type="button" onClick={() => onReady(useCheckin ? { anxietyBefore: anx, prediction: prediction.trim(), drop } : null)}>
          I'm ready to present
        </button>
        {prepLeft == null && (
          <button className="secondary" type="button" onClick={() => setPrepLeft(60)}>
            60 seconds to prepare
          </button>
        )}
      </div>
    </section>
  );
}
