import { useId, useState, type ReactNode } from "react";
import type { Experiment, LadderStep, Reframe, ThinkingTrap } from "../../shared/types";
import {
  OUTWARD_FOCUS_TIP,
  SAFETY_BEHAVIOURS,
  STARTER_STEPS,
  THINKING_TRAPS,
  activeLadder,
  suggestNextStep,
  summarizeExperiments,
} from "../../shared/confidence";
import { CRISIS_RESOURCES, mentionsCrisis } from "../../shared/safety";
import { useApp } from "../lib/store";
import { uid } from "../lib/storage";
import { formatDate } from "../components/common";

type View = { name: "home" } | { name: "plan"; step?: LadderStep } | { name: "checkin"; id: string } | { name: "ladder" } | { name: "reframe" };

export { CrisisList };

export function Confidence() {
  const { data, update } = useApp();
  const [view, setView] = useState<View>({ name: "home" });
  const [flash, setFlash] = useState<string | null>(null);
  const go = (v: View, msg: string | null = null) => {
    setFlash(msg);
    setView(v);
    window.scrollTo?.({ top: 0 });
  };

  if (view.name === "plan")
    return (
      <PlanStep
        step={view.step}
        onCancel={() => go({ name: "home" })}
        onSave={(e) => {
          update((d) => ({ ...d, experiments: [...d.experiments, e] }));
          go({ name: "home" }, "Saved. Come back afterwards and tell us how it went.");
        }}
      />
    );
  if (view.name === "checkin") {
    const exp = data.experiments.find((e) => e.id === view.id);
    if (!exp) return null;
    return (
      <CheckIn
        exp={exp}
        onCancel={() => go({ name: "home" })}
        onSave={(done) => {
          update((d) => ({ ...d, experiments: d.experiments.map((e) => (e.id === done.id ? done : e)) }));
          go({ name: "home" }, resultMessage(done));
        }}
      />
    );
  }
  if (view.name === "ladder") return <Ladder onBack={() => go({ name: "home" })} onPlan={(step) => go({ name: "plan", step })} />;
  if (view.name === "reframe")
    return (
      <ReframeFlow
        onCancel={() => go({ name: "home" })}
        onSave={(r) => {
          update((d) => ({ ...d, reframes: [...d.reframes, r] }));
          go({ name: "home" }, "Saved. Nice work untangling that.");
        }}
      />
    );

  const next = suggestNextStep(data.ladder, data.experiments);
  const pending = data.experiments.filter((e) => !e.completedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sum = summarizeExperiments(data.experiments);

  return (
    <main className="screen" id="main">
      <h2 className="page-title">Confidence</h2>
      <p className="hint">Small brave steps, and a calmer way to think about them.</p>

      {!data.confidenceIntroSeen && (
        <div className="notice">
          <p>
            These are self-help tools based on techniques from cognitive behavioural therapy (CBT). They're not therapy or a diagnosis. If anxiety is getting in the
            way of work, relationships or daily life, a doctor or licensed therapist can help.
          </p>
          <button className="secondary" type="button" onClick={() => update((d) => ({ ...d, confidenceIntroSeen: true }))}>
            Got it
          </button>
        </div>
      )}
      {flash && (
        <p className="notice ok" role="status">
          {flash}
        </p>
      )}

      {pending.map((e) => (
        <button key={e.id} type="button" className="pill-link as-button" onClick={() => go({ name: "checkin", id: e.id })}>
          <span>
            <strong>How did it go?</strong> {e.situation}
          </span>
          <span aria-hidden="true">→</span>
        </button>
      ))}

      <article className="featured">
        <p className="eyebrow">Next brave step</p>
        {next ? (
          <>
            <h3>{next.title}</h3>
            <p className="hint">
              {(() => {
                const tries = data.experiments.filter((e) => e.ladderStepId === next.id && e.completedAt);
                const last = tries[tries.length - 1];
                return last
                  ? `Tried ${tries.length}× · last time ${last.anxietyAfter}/10. Repeating a step until it feels about 4/10 is how it gets easier.`
                  : `Expected discomfort: ${next.expectedDiscomfort}/10`;
              })()}
            </p>
            <button className="primary" type="button" onClick={() => go({ name: "plan", step: next })}>
              Plan it
            </button>
          </>
        ) : (
          <>
            <h3>Plan a speaking moment</h3>
            <p className="hint">Predict what you're worried about, do it, then compare. It's how you find out what really happens.</p>
            <button className="primary" type="button" onClick={() => go({ name: "plan" })}>
              Plan one
            </button>
          </>
        )}
      </article>

      {sum.completed > 0 && (
        <p className="result-line">
          <strong>
            {sum.fearNotHappened} of {sum.completed}
          </strong>{" "}
          feared outcome{sum.completed === 1 ? "" : "s"} didn't happen
          {sum.fearPartly ? ` · ${sum.fearPartly} partly` : ""}.
        </p>
      )}

      <ul className="rows tools">
        <li className="row-item">
          <button type="button" className="row-button" onClick={() => go({ name: "ladder" })}>
            <span className="row-title">Brave steps ladder</span>
            <span className="row-desc">Rank speaking situations from easier to harder, then climb one rung at a time.</span>
          </button>
        </li>
        <li className="row-item">
          <button type="button" className="row-button" onClick={() => go({ name: "reframe" })}>
            <span className="row-title">Untangle a thought</span>
            <span className="row-desc">Catch an anxious thought, spot the thinking trap, find a more balanced view.</span>
          </button>
        </li>
      </ul>

      <details className="more">
        <summary>Need support now?</summary>
        <CrisisList />
      </details>
    </main>
  );
}

function resultMessage(e: Experiment): string {
  const close = " That's logged — no need to replay it.";
  if (e.outcome === "didnt-happen") return `What you feared didn't happen. You rated it ${e.predictionLikelihood}% likely beforehand.${close}`;
  if (e.outcome === "partly") return `Part of it happened — and you got through it. That's useful evidence too.${close}`;
  return `It happened, and you got through it. Note what helped for next time.${close}`;
}

// ---------- Shared bits ----------

function Slider({ label, value, onChange, min, max, suffix }: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; suffix?: string }) {
  const id = useId();
  return (
    <div className="slider">
      <div className="slider-head">
        <label className="label" htmlFor={id}>
          {label}
        </label>
        <output htmlFor={id} aria-live="polite">
          {value}
          {suffix}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={max === 100 ? 5 : 1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className="slider-ends" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, rows = 2, hint }: { label: string; value: string; onChange: (s: string) => void; rows?: number; hint?: string }) {
  const id = useId();
  return (
    <>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="hint">{hint}</p>}
      <textarea id={id} rows={rows} maxLength={600} value={value} onChange={(e) => onChange(e.target.value)} />
    </>
  );
}

function CrisisList() {
  return (
    <ul className="plain">
      {CRISIS_RESOURCES.map((r) => (
        <li key={r.label}>{r.href ? <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{r.label}</a> : r.label}</li>
      ))}
    </ul>
  );
}

function CrisisNotice({ texts }: { texts: string[] }) {
  if (!mentionsCrisis(...texts)) return null;
  return (
    <div className="notice warn" role="alert">
      <p>
        <strong>It sounds like things might be really hard right now.</strong> You deserve support from a person. This app can't help in a crisis, but these can:
      </p>
      <CrisisList />
    </div>
  );
}

function SubScreen({ title, eyebrow, onBack, children }: { title: string; eyebrow: string; onBack: () => void; children: ReactNode }) {
  return (
    <main className="screen" id="main">
      <button className="link back" type="button" onClick={onBack}>
        ← Back
      </button>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {children}
    </main>
  );
}

// ---------- Plan a brave step (behavioural experiment) ----------

function PlanStep({ step, onCancel, onSave }: { step?: LadderStep; onCancel: () => void; onSave: (e: Experiment) => void }) {
  const [situation, setSituation] = useState(step?.title ?? "");
  const [prediction, setPrediction] = useState("");
  const [likelihood, setLikelihood] = useState(60);
  const [anxiety, setAnxiety] = useState(5);
  const [drop, setDrop] = useState<string | undefined>();
  const ok = situation.trim().length > 2 && prediction.trim().length > 2;
  return (
    <SubScreen eyebrow="Brave step" title="Plan it" onBack={onCancel}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          onSave({
            id: uid("x-"),
            createdAt: new Date().toISOString(),
            kind: "real-world",
            situation: situation.trim(),
            ladderStepId: step?.id,
            prediction: prediction.trim(),
            predictionLikelihood: likelihood,
            anxietyBefore: anxiety,
            safetyBehaviourToDrop: drop,
          });
        }}
      >
        <TextField label="What will you do?" value={situation} onChange={setSituation} hint="e.g. Ask one question in Tuesday's team meeting" />
        <TextField label="What are you worried will happen?" value={prediction} onChange={setPrediction} hint="Be specific: 'My voice will shake and people will think I'm unprepared.'" />
        <Slider label="How likely does that feel?" value={likelihood} onChange={setLikelihood} min={0} max={100} suffix="%" />
        <Slider label="How anxious do you feel about it now?" value={anxiety} onChange={setAnxiety} min={0} max={10} suffix="/10" />
        <fieldset className="pills">
          <legend className="label">Optional: one habit to drop this time</legend>
          {SAFETY_BEHAVIOURS.map((b) => (
            <label key={b} className={drop === b ? "pill on" : "pill"}>
              <input type="radio" name="drop" checked={drop === b} onChange={() => setDrop(b)} onClick={() => drop === b && setDrop(undefined)} />
              {b}
            </label>
          ))}
        </fieldset>
        <p className="focus-tip">{OUTWARD_FOCUS_TIP}</p>
        <CrisisNotice texts={[situation, prediction]} />
        <div className="actions sticky">
          <button className="primary" type="submit" disabled={!ok}>
            Save my plan
          </button>
        </div>
      </form>
    </SubScreen>
  );
}

// ---------- Check in afterwards ----------

function CheckIn({ exp, onCancel, onSave }: { exp: Experiment; onCancel: () => void; onSave: (e: Experiment) => void }) {
  const [anxietyAfter, setAnxietyAfter] = useState(exp.anxietyBefore);
  const [outcome, setOutcome] = useState<Experiment["outcome"]>();
  const [whatHappened, setWhatHappened] = useState("");
  const [wentOkay, setWentOkay] = useState("");
  const [learned, setLearned] = useState("");
  return (
    <SubScreen eyebrow={formatDate(exp.createdAt)} title="How did it go?" onBack={onCancel}>
      <p className="task">{exp.situation}</p>
      <div className="callout">
        <p className="eyebrow">You predicted ({exp.predictionLikelihood}% likely)</p>
        <p>{exp.prediction}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!outcome) return;
          onSave({ ...exp, completedAt: new Date().toISOString(), anxietyAfter, outcome, whatHappened: whatHappened.trim(), wentOkay: wentOkay.trim(), learned: learned.trim() });
        }}
      >
        <fieldset className="options">
          <legend className="label">Did what you feared happen?</legend>
          {(
            [
              ["didnt-happen", "No, it didn't"],
              ["partly", "Partly"],
              ["happened", "Yes, it did"],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className={outcome === v ? "option on" : "option"}>
              <input type="radio" name="outcome" checked={outcome === v} onChange={() => setOutcome(v)} />
              {l}
            </label>
          ))}
        </fieldset>
        <Slider label="How anxious were you while doing it?" value={anxietyAfter} onChange={setAnxietyAfter} min={0} max={10} suffix="/10" />
        <TextField label="What actually happened? (optional)" value={whatHappened} onChange={setWhatHappened} />
        <TextField label="One thing that went okay" value={wentOkay} onChange={setWentOkay} hint="Replaying only the awkward bits keeps anxiety going. Name something that went fine." />
        <TextField label="What did you learn? (optional)" value={learned} onChange={setLearned} />
        <CrisisNotice texts={[whatHappened, wentOkay, learned]} />
        <div className="actions sticky">
          <button className="primary" type="submit" disabled={!outcome}>
            Save
          </button>
        </div>
      </form>
    </SubScreen>
  );
}

// ---------- Brave steps ladder (graded exposure) ----------

function Ladder({ onBack, onPlan }: { onBack: () => void; onPlan: (s: LadderStep) => void }) {
  const { data, update } = useApp();
  const [title, setTitle] = useState("");
  const [disc, setDisc] = useState(5);
  const steps = activeLadder(data.ladder);
  const suggestions = STARTER_STEPS.filter((s) => !steps.some((x) => x.title === s.title)).slice(0, steps.length === 0 ? 6 : 3);
  const add = (t: string, d: number) =>
    update((x) => ({ ...x, ladder: [...x.ladder, { id: uid("l-"), createdAt: new Date().toISOString(), title: t, expectedDiscomfort: d }] }));

  return (
    <SubScreen eyebrow="Confidence" title="Brave steps ladder" onBack={onBack}>
      <p className="hint">Start with steps that feel uncomfortable but doable. Move up when a step feels manageable (around 4/10 or less).</p>
      {suggestions.length > 0 && (
        <>
          <p className="label">{steps.length === 0 ? "Quick start — tap to add" : "Suggestions"}</p>
          <div className="pills">
            {suggestions.map((s) => (
              <button key={s.title} type="button" className="pill" onClick={() => add(s.title, s.expectedDiscomfort)}>
                + {s.title}
              </button>
            ))}
          </div>
        </>
      )}
      {steps.length > 0 && (
        <ol className="ladder">
          {[...steps].reverse().map((s) => {
            const tries = data.experiments.filter((e) => e.ladderStepId === s.id && e.completedAt);
            const last = tries[tries.length - 1];
            return (
              <li key={s.id} className="rung">
                <span className="rung-score" aria-label={`Expected discomfort ${s.expectedDiscomfort} out of 10`}>
                  {s.expectedDiscomfort}
                </span>
                <span className="rung-body">
                  <span className="rung-title">{s.title}</span>
                  {last && (
                    <span className="hint block">
                      Tried {tries.length}× · last time {last.anxietyAfter}/10
                    </span>
                  )}
                </span>
                <span className="rung-actions">
                  <button type="button" className="secondary small" onClick={() => onPlan(s)}>
                    Plan
                  </button>
                  <button
                    type="button"
                    className="link small"
                    aria-label={`Remove ${s.title}`}
                    onClick={() => update((x) => ({ ...x, ladder: x.ladder.map((y) => (y.id === s.id ? { ...y, archived: true } : y)) }))}
                  >
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <form
        className="add-step"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim().length < 3) return;
          add(title.trim(), disc);
          setTitle("");
        }}
      >
        <label className="label" htmlFor="new-step">
          Add your own step
        </label>
        <input id="new-step" value={title} maxLength={140} placeholder="e.g. Introduce myself at the all-hands" onChange={(e) => setTitle(e.target.value)} />
        <Slider label="Expected discomfort" value={disc} onChange={setDisc} min={0} max={10} suffix="/10" />
        <button className="secondary" type="submit" disabled={title.trim().length < 3}>
          Add step
        </button>
      </form>
    </SubScreen>
  );
}

// ---------- Untangle a thought (cognitive restructuring) ----------

function ReframeFlow({ onCancel, onSave }: { onCancel: () => void; onSave: (r: Reframe) => void }) {
  const { data } = useApp();
  const [step, setStep] = useState(1);
  const [situation, setSituation] = useState("");
  const [thought, setThought] = useState("");
  const [beliefBefore, setBeliefBefore] = useState(70);
  const [traps, setTraps] = useState<ThinkingTrap[]>([]);
  const [evidenceAgainst, setEvidenceAgainst] = useState("");
  const [friendAdvice, setFriendAdvice] = useState("");
  const [balanced, setBalanced] = useState("");
  const [beliefAfter, setBeliefAfter] = useState(40);
  const all = [situation, thought, evidenceAgainst, friendAdvice, balanced];
  const chosen = THINKING_TRAPS.filter((t) => traps.includes(t.id));

  return (
    <SubScreen eyebrow={`Untangle a thought · ${step} of 4`} title={["", "Catch the thought", "Spot the trap", "Check it", "A more balanced view"][step]!} onBack={step === 1 ? onCancel : () => setStep(step - 1)}>
      <CrisisNotice texts={all} />
      {step === 1 && (
        <>
          <TextField label="What's the situation?" value={situation} onChange={setSituation} hint="e.g. Presenting the quarterly numbers on Thursday" />
          <TextField label="What's the anxious thought?" value={thought} onChange={setThought} hint="e.g. 'I'll go blank and everyone will think I don't know my job.'" />
          <Slider label="How much do you believe it?" value={beliefBefore} onChange={setBeliefBefore} min={0} max={100} suffix="%" />
          <div className="actions sticky">
            <button className="primary" type="button" disabled={thought.trim().length < 3} onClick={() => setStep(2)}>
              Next
            </button>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="hint">Which of these sound familiar? Pick any that fit — or none.</p>
          <div className="trap-list">
            {THINKING_TRAPS.map((t) => {
              const on = traps.includes(t.id);
              return (
                <button key={t.id} type="button" className={on ? "trap on" : "trap"} aria-pressed={on} onClick={() => setTraps((xs) => (on ? xs.filter((x) => x !== t.id) : [...xs, t.id]))}>
                  <strong>{t.name}</strong>
                  <span>{t.plain}</span>
                </button>
              );
            })}
          </div>
          <div className="actions sticky">
            <button className="primary" type="button" onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <p className="callout">“{thought}”</p>
          {chosen.length > 0 && (
            <ul className="plain">
              {chosen.map((t) => (
                <li key={t.id}>
                  <strong>{t.name}:</strong> {t.question}
                </li>
              ))}
            </ul>
          )}
          <TextField label="What doesn't fit the thought?" value={evidenceAgainst} onChange={setEvidenceAgainst} hint="Times it went fine, things people actually said, what you know about the topic." rows={3} />
          <TextField label="What would you tell a friend who thought this?" value={friendAdvice} onChange={setFriendAdvice} rows={3} />
          <div className="actions sticky">
            <button className="primary" type="button" onClick={() => setStep(4)}>
              Next
            </button>
          </div>
        </>
      )}
      {step === 4 && (
        <>
          <TextField
            label="Write a more balanced thought"
            value={balanced}
            onChange={setBalanced}
            rows={3}
            hint="Not forced positivity — something realistic you could believe. e.g. 'I might stumble once, but I know this material and people mostly care about the numbers.'"
          />
          <Slider label="How much do you believe the original thought now?" value={beliefAfter} onChange={setBeliefAfter} min={0} max={100} suffix="%" />
          <div className="actions sticky">
            <button
              className="primary"
              type="button"
              disabled={balanced.trim().length < 3}
              onClick={() =>
                onSave({
                  id: uid("t-"),
                  at: new Date().toISOString(),
                  situation: situation.trim(),
                  thought: thought.trim(),
                  beliefBefore,
                  traps,
                  evidenceAgainst: evidenceAgainst.trim(),
                  friendAdvice: friendAdvice.trim(),
                  balanced: balanced.trim(),
                  beliefAfter,
                })
              }
            >
              Save
            </button>
          </div>
        </>
      )}
      {step === 1 && data.reframes.length > 0 && (
        <details className="more">
          <summary>Past thoughts ({data.reframes.length})</summary>
          <ul className="plain">
            {[...data.reframes].reverse().map((r) => (
              <li key={r.id}>
                <span className="hint">{formatDate(r.at)}</span> “{r.thought}” → <em>{r.balanced}</em>{" "}
                <span className="hint">
                  ({r.beliefBefore}% → {r.beliefAfter ?? "?"}%)
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </SubScreen>
  );
}
