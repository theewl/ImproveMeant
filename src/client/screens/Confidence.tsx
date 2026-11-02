import { useId, useState, type ReactNode } from "react";
import type { Experiment, LadderStep, Reframe, ThinkingTrap } from "../../shared/types";
import {
  OUTWARD_FOCUS_TIP,
  SAFETY_BEHAVIOURS,
  STARTER_STEPS,
  THINKING_TRAPS,
  activeLadder,
  summarizeExperiments,
  compareSafetyBehaviours,
  IMPACT_QUESTIONS,
  IMPACT_SCALE,
  impactGuidance,
} from "../../shared/confidence";
import { CrisisList, CrisisNotice } from "../components/Crisis";
import { CAMERA_PRINCIPLES, CAMERA_SETUP } from "../../shared/camera";
import { PLAYBOOK } from "../../shared/vlog";
import { allSteps, nextStep, realStepIdeas, stepKindLabel, stepRecord, type Step } from "../../shared/steps";
import { href } from "../lib/router";
import { useApp } from "../lib/store";
import { uid } from "../lib/storage";
import { formatDate } from "../components/common";

type View = { name: "home" } | { name: "start" } | { name: "pick" } | { name: "plan"; step?: LadderStep } | { name: "checkin"; id: string } | { name: "reframe" } | { name: "selfcheck" };

/**
 * Steps: one ladder for every way of practising (explain, camera, talk, real life),
 * with the confidence tools (predict → do it → check what happened; untangle a thought;
 * self-check) around it. Thought untangling and the self-check are side doors.
 */
export function Confidence() {
  const { data, update } = useApp();
  const [view, setView] = useState<View>(data.confidenceIntroSeen ? { name: "home" } : { name: "start" });
  const [flash, setFlash] = useState<string | null>(null);
  const go = (v: View, msg: string | null = null) => {
    setFlash(msg);
    setView(v);
    window.scrollTo?.({ top: 0 });
  };

  if (view.name === "start")
    return (
      <Start
        onDone={(habits) => {
          update((d) => ({ ...d, confidenceIntroSeen: true, myHabits: habits }));
          go({ name: "pick" });
        }}
      />
    );
  if (view.name === "pick") return <Ladder onBack={() => go({ name: "home" })} onPlan={(step) => go({ name: "plan", step })} />;
  if (view.name === "plan")
    return (
      <PlanStep
        step={view.step}
        defaultDrop={data.myHabits?.[0]}
        onCancel={() => go({ name: "home" })}
        onSave={(e) => {
          update((d) => ({ ...d, experiments: [...d.experiments, e] }));
          go({ name: "home" }, "Planned. When you've done it, come back and tap “What happened?”.");
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
  if (view.name === "selfcheck") return <SelfCheck onBack={() => go({ name: "home" })} />;
  if (view.name === "reframe")
    return (
      <ReframeFlow
        onCancel={() => go({ name: "home" })}
        onSave={(r) => {
          update((d) => ({ ...d, reframes: [...d.reframes, r] }));
          go({ name: "home" }, "Saved. Now the real test: take the step and see what happens.");
        }}
      />
    );

  const pending = data.experiments.filter((e) => !e.completedAt && e.kind === "real-world").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const real = summarizeExperiments(data.experiments.filter((e) => e.kind === "real-world"));
  const reh = summarizeExperiments(data.experiments.filter((e) => e.kind !== "real-world"));
  const cmp = compareSafetyBehaviours(data.experiments);
  const next = nextStep(data, data.prefs.goal);
  const steps = allSteps(data);
  const ideas = realStepIdeas(data.ladder);
  const ladderStep = (st: Step) => {
    const t = st.target;
    return t.kind === "real" ? data.ladder.find((l) => l.id === t.ladderStepId) : undefined;
  };
  const stepHref = (st: Step): string | null => {
    switch (st.target.kind) {
      case "learn":
        return href({ name: "today" });
      case "camera":
        return href({ name: "camera", drillId: st.target.drillId });
      case "talk":
        return href({ name: "talk", scenario: st.target.scenario });
      case "real":
        return null;
    }
  };

  return (
    <main className="screen" id="main">
      <h2 className="page-title">Steps</h2>
      <p className="hint">One method for all of it: pick a step that's slightly uncomfortable, say what you fear, do it out loud, get one note, do it again, then check what really happened.</p>
      {flash && (
        <p className="notice ok" role="status">
          {flash}
        </p>
      )}

      {pending.map((e) => (
        <article key={e.id} className="featured">
          <p className="eyebrow">Your real-life step, planned</p>
          <h3>{e.situation}</h3>
          <p className="hint">
            You expect: {e.prediction || "—"} ({e.predictionLikelihood}% sure){e.safetyBehaviourToDrop ? ` · without: ${e.safetyBehaviourToDrop.toLowerCase()}` : ""}
          </p>
          <p className="focus-tip">{OUTWARD_FOCUS_TIP}</p>
          <button className="primary" type="button" onClick={() => go({ name: "checkin", id: e.id })}>
            What happened?
          </button>
        </article>
      ))}

      {pending.length === 0 && (
        <article className="featured">
          <p className="eyebrow">
            Next step · {stepKindLabel(next.kind)} · expected discomfort {next.discomfort}/10
          </p>
          <h3>{next.title}</h3>
          <p>{next.detail}</p>
          {stepHref(next) ? (
            <a className="button primary" href={stepHref(next)!}>
              Start<span className="sr-only">: {next.title}</span>
            </a>
          ) : (
            <button className="primary" type="button" onClick={() => go({ name: "plan", step: ladderStep(next) })}>
              Plan this step
            </button>
          )}
        </article>
      )}

      <section aria-labelledby="ladder-h">
        <h3 id="ladder-h" className="section-title">
          The ladder, easiest first
        </h3>
        <ol className="ladder">
          {steps.map((st) => {
            const r = stepRecord(st, data);
            const h = stepHref(st);
            const body = (
              <>
                <span className="ladder-level" aria-label={`Expected discomfort ${st.discomfort} out of 10`}>
                  {st.discomfort}
                </span>
                <span className="ladder-body">
                  <span className="row-title">{st.title}</span>
                  <span className="row-desc">
                    {stepKindLabel(st.kind)}
                    {r.count > 0 ? ` · done ${r.count}×${r.lastAnxiety != null ? `, last time ${r.lastAnxiety}/10 anxious` : ""}` : ""}
                  </span>
                </span>
                <span aria-hidden="true">→</span>
              </>
            );
            return (
              <li key={st.id} className={r.count > 0 ? "ladder-item done" : "ladder-item"}>
                {h ? (
                  <a href={h}>{body}</a>
                ) : (
                  <button type="button" className="ladder-button" onClick={() => go({ name: "plan", step: ladderStep(st) })}>
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        <div className="row wrap">
          <button className="secondary small" type="button" onClick={() => go({ name: "pick" })}>
            Add a real-life step
          </button>
          {ideas.length > 0 && <span className="hint">e.g. {ideas[0]!.title.toLowerCase()}</span>}
        </div>
      </section>

      {(real.tested > 0 || reh.tested > 0 || cmp) && (
        <section className="record" aria-labelledby="record-h">
          <h3 id="record-h" className="section-title">
            Your record
          </h3>
          {real.tested > 0 && (
            <p>
              Real life: <strong>{real.fearNotHappened} of {real.tested}</strong> feared outcome{real.tested === 1 ? "" : "s"} didn't happen
              {real.fearPartly ? ` (${real.fearPartly} partly)` : ""}.
            </p>
          )}
          {reh.tested > 0 && (
            <p>
              Practice sessions: <strong>{reh.fearNotHappened} of {reh.tested}</strong> didn't happen{reh.fearPartly ? ` (${reh.fearPartly} partly)` : ""}.
            </p>
          )}
          {cmp && (
            <p className="hint">
              Without a safety habit, your anxiety during was {cmp.dropped.avgAnxiety}/10 on average ({cmp.dropped.count}); with your usual habits, {cmp.kept.avgAnxiety}/10 (
              {cmp.kept.count}). Small numbers — a hint, not proof.
            </p>
          )}
        </section>
      )}

      <ul className="rows tools">
        <li className="row-item">
          <button type="button" className="row-button" onClick={() => go({ name: "reframe" })}>
            <span className="row-title">A thought keeps bugging you?</span>
            <span className="row-desc">Untangle it in four short steps, then take the step anyway.</span>
          </button>
        </li>
        <li className="row-item">
          <button type="button" className="row-button" onClick={() => go({ name: "start" })}>
            <span className="row-title">Why speaking feels so hard</span>
            <span className="row-desc">The loop that keeps anxiety going, and your own habits.</span>
          </button>
        </li>
        <li className="row-item">
          <button type="button" className="row-button" onClick={() => go({ name: "selfcheck" })}>
            <span className="row-title">Is it getting in the way?</span>
            <span className="row-desc">A short private check-in, with guidance on when to get support. Not a test.</span>
          </button>
        </li>
      </ul>

      <details className="more">
        <summary>Before you record: five camera checks</summary>
        <ul className="plain checks">
          {CAMERA_SETUP.map((c) => (
            <li key={c.id}>
              <strong>{c.text}.</strong> {c.why}
            </li>
          ))}
        </ul>
      </details>
      <details className="more">
        <summary>What the best creators do, and what this app does about it</summary>
        <ul className="plain checks">
          {PLAYBOOK.map((p) => (
            <li key={p.who}>
              <strong>{p.who}:</strong> {p.what} <em>Here: {p.inApp}</em>
            </li>
          ))}
        </ul>
      </details>
      <details className="more">
        <summary>What makes talking to a camera work</summary>
        <ul className="plain checks">
          {CAMERA_PRINCIPLES.map((pr) => (
            <li key={pr.title}>
              <strong>{pr.title}.</strong> {pr.text}
            </li>
          ))}
        </ul>
      </details>

      <section className="support-row" aria-labelledby="support-h">
        <h3 id="support-h" className="section-title">
          Need support now?
        </h3>
        <CrisisList />
      </section>
    </main>
  );
}

const HABIT_OPTIONS = ["I rehearse every word", "I avoid eye contact", "I keep it as short as I can", "I watch my own voice or hands", "I skip it if I can"];
const HABIT_TO_BEHAVIOR: Record<string, string> = {
  "I rehearse every word": "Scripting every word",
  "I avoid eye contact": "Avoiding eye contact",
  "I keep it as short as I can": "Rushing to get it over with",
  "I watch my own voice or hands": "Staying quiet unless asked",
  "I skip it if I can": "Staying quiet unless asked",
};

/** Step 0: why it feels hard (four plain sentences) and which habits are yours. */
function Start({ onDone }: { onDone: (habits: string[]) => void }) {
  const { data } = useApp();
  const [picked, setPicked] = useState<string[]>(() => HABIT_OPTIONS.filter((h) => data.myHabits?.includes(HABIT_TO_BEHAVIOR[h]!)));
  return (
    <main className="screen" id="main">
      <p className="eyebrow">Steps</p>
      <h2>Why speaking feels so hard</h2>
      <div className="loop">
        <p>When you're worried about how you come across, your attention turns inward. You start watching yourself — your voice, your face, your hands — and you build a picture of how you think you look. It's usually worse than the truth.</p>
        <p>To cope, you do small things that feel safer: rehearse every line, avoid eye contact, keep it short, or skip it altogether. Those habits feel like help, but they stop you from ever finding out that the thing you fear mostly doesn't happen.</p>
        <p>
          <strong>The way out:</strong> put your attention on the people you're talking to, drop one safety habit at a time, and check what really happened.
        </p>
      </div>
      <fieldset className="options">
        <legend className="label">Which of these do you do?</legend>
        {HABIT_OPTIONS.map((h) => {
          const on = picked.includes(h);
          return (
            <label key={h} className={on ? "option on" : "option"}>
              <input type="checkbox" checked={on} onChange={() => setPicked((xs) => (on ? xs.filter((x) => x !== h) : [...xs, h]))} />
              {h}
            </label>
          );
        })}
      </fieldset>
      <p className="hint">This is self-help based on CBT techniques. It's not therapy or a diagnosis. If anxiety is getting in the way of work, friendships or daily life, a doctor or licensed therapist can help.</p>
      <div className="actions sticky">
        <button className="primary" type="button" onClick={() => onDone([...new Set(picked.map((h) => HABIT_TO_BEHAVIOR[h]!))])}>
          Got it
        </button>
      </div>
    </main>
  );
}

function resultMessage(e: Experiment): string {
  const close = " That's logged — no need to replay it.";
  if (e.outcome === "didnt-happen") return `What you feared didn't happen. You rated it ${e.predictionLikelihood}% likely beforehand.${close} Ready for the next step?`;
  if (e.outcome === "partly") return `Part of it happened — and you got through it. That's useful evidence too.${close}`;
  return `It happened, and you got through it. That's still a step taken. Next time, you could try a smaller version of this step.${close}`;
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

// ---------- Plan a brave step (behavioral experiment) ----------

function PlanStep({ step, defaultDrop, onCancel, onSave }: { step?: LadderStep; defaultDrop?: string; onCancel: () => void; onSave: (e: Experiment) => void }) {
  const [situation, setSituation] = useState(step?.title ?? "");
  const [prediction, setPrediction] = useState("");
  const [likelihood, setLikelihood] = useState(60);
  const [anxiety, setAnxiety] = useState(5);
  const [drop, setDrop] = useState<string | undefined>(defaultDrop);
  const [obstacle, setObstacle] = useState("");
  const [action, setAction] = useState("");
  const [worry, setWorry] = useState(""); // deliberately not saved
  const [page, setPage] = useState(1);
  const ok = situation.trim().length > 2 && prediction.trim().length > 2;
  const titles = ["", "What will you do?", "What are you worried will happen?", "Before you go"];
  return (
    <SubScreen eyebrow={`Brave step · ${page} of 3`} title={titles[page]!} onBack={page === 1 ? onCancel : () => setPage(page - 1)}>
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
            ifThen: obstacle.trim() && action.trim() ? { obstacle: obstacle.trim(), action: action.trim() } : undefined,
          });
        }}
      >
        <div hidden={page !== 1}>
          <TextField label="What will you do?" value={situation} onChange={setSituation} hint="e.g. Ask one question in Tuesday's team meeting" />
          <div className="actions sticky">
            <button className="primary" type="button" disabled={situation.trim().length < 3} onClick={() => setPage(2)}>
              Next
            </button>
          </div>
        </div>
        <div hidden={page !== 2}>
          <TextField label="What are you worried will happen?" value={prediction} onChange={setPrediction} hint="Be specific: 'My voice will shake and people will think I'm unprepared.'" />
          <Slider label="How likely does that feel?" value={likelihood} onChange={setLikelihood} min={0} max={100} suffix="%" />
          <Slider label="How anxious do you feel about it now?" value={anxiety} onChange={setAnxiety} min={0} max={10} suffix="/10" />
          <div className="actions sticky">
            <button className="primary" type="button" disabled={prediction.trim().length < 3} onClick={() => setPage(3)}>
              Next
            </button>
          </div>
        </div>
        <div hidden={page !== 3}>
        <fieldset className="pills">
          <legend className="label">Optional: one habit to drop this time</legend>
          {SAFETY_BEHAVIOURS.map((b) => (
            <label key={b} className={drop === b ? "pill on" : "pill"}>
              <input type="radio" name="drop" checked={drop === b} onChange={() => setDrop(b)} onClick={() => drop === b && setDrop(undefined)} />
              {b}
            </label>
          ))}
        </fieldset>
        <div className="ifthen">
          <p className="label">If something gets in the way, then I will… (optional)</p>
          <p className="hint">Planning one obstacle and one response in advance makes follow-through more likely. Keep both short.</p>
          <label className="sr-only" htmlFor="if-obstacle">
            If
          </label>
          <div className="ifthen-row">
            <span>If</span>
            <input id="if-obstacle" value={obstacle} maxLength={160} placeholder="I'm asked a follow-up I can't answer" onChange={(e) => setObstacle(e.target.value)} />
          </div>
          <label className="sr-only" htmlFor="if-action">
            then I will
          </label>
          <div className="ifthen-row">
            <span>then I will</span>
            <input id="if-action" value={action} maxLength={160} placeholder="say “Good question — the short answer is…”" onChange={(e) => setAction(e.target.value)} />
          </div>
        </div>
        {anxiety >= 7 && (
          <div className="worry-box">
            <p className="label">Feeling very anxious about it? Write out your worries (optional)</p>
            <p className="hint">Some people find that writing freely about their worries for a couple of minutes before a stressful moment takes the edge off. Optional. This box isn't saved anywhere.</p>
            <textarea aria-label="Write out your worries" rows={5} value={worry} onChange={(e) => setWorry(e.target.value)} />
          </div>
        )}
        <p className="focus-tip">{OUTWARD_FOCUS_TIP}</p>
        <div className="actions sticky">
          <button className="primary" type="submit" disabled={!ok}>
            Save my plan
          </button>
        </div>
        </div>
        <CrisisNotice texts={[situation, prediction, worry]} />
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
        {exp.ifThen && (
          <p className="hint">
            Your plan: if {exp.ifThen.obstacle}, then {exp.ifThen.action}.
          </p>
        )}
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
        {outcome === "happened" && (
          <p className="notice">
            Getting through it when the thing you feared happened is hard, and you did. What helped you cope? If this step felt too big, the next one can be smaller.
          </p>
        )}
        <TextField label="One thing that went okay" value={wentOkay} onChange={setWentOkay} hint="Replaying only the awkward bits keeps anxiety going. Name something that went fine." />
        <TextField label="One line for next time (optional)" value={learned} onChange={setLearned} hint="What did you learn, or what's the next rung?" />
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
    <SubScreen eyebrow="Steps" title="Add a real-life step" onBack={onBack}>
      <p className="hint">Start easier than you think you need to. A step counts once you've tested what you feared — anxiety doesn't have to drop. Repeat any step whenever you like.</p>
      {suggestions.length > 0 && (
        <>
          <p className="label">{steps.length === 0 ? "Tap to add a step" : "More ideas"}</p>
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
  const [beliefAfterRaw, setBeliefAfter] = useState<number | null>(null);
  const beliefAfter = beliefAfterRaw ?? beliefBefore;
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
          <TextField
            label="What would you tell a friend who thought this?"
            value={friendAdvice}
            onChange={setFriendAdvice}
            rows={3}
            hint="Or talk to yourself by name, as a friend would: “Sam, you've explained this before.” A little distance makes it easier to be fair."
          />
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

// ---------- Self-check (non-diagnostic) ----------

function SelfCheck({ onBack }: { onBack: () => void }) {
  const { data, update } = useApp();
  const [answers, setAnswers] = useState<(number | null)[]>(IMPACT_QUESTIONS.map(() => null));
  const [result, setResult] = useState<"seek-support" | "self-help" | null>(null);
  const [qi, setQi] = useState(0);
  const last = data.impactChecks[data.impactChecks.length - 1];
  const complete = answers.every((a) => a != null);

  if (result) {
    return (
      <SubScreen eyebrow="Self-check" title="Thanks for checking in" onBack={onBack}>
        {result === "seek-support" ? (
          <div className="notice warn">
            <p>
              <strong>It sounds like anxiety is getting in the way a lot right now.</strong> That's worth raising with a doctor or a licensed therapist. They can help you work
              out what's going on and what would help. Talking therapies such as CBT help many people who feel anxious about speaking or social situations.
            </p>
            <p>You can keep using these tools alongside that. They're practice, not a replacement for support.</p>
          </div>
        ) : (
          <div className="notice ok">
            <p>
              The brave steps and thought tools here may help. If anxiety starts getting in the way more — at work, with friends, or by making you avoid things — a
              doctor or licensed therapist can help.
            </p>
          </div>
        )}
        <p className="hint">This isn't a test or a diagnosis, and it isn't scored. Your answers stay on this device so you can see how things change over time.</p>
        <details className="more">
          <summary>Get help now</summary>
          <CrisisList />
        </details>
        <div className="actions">
          <button className="primary" type="button" onClick={onBack}>
            Done
          </button>
        </div>
      </SubScreen>
    );
  }

  return (
    <SubScreen eyebrow={`Self-check · ${qi + 1} of ${IMPACT_QUESTIONS.length} · not a diagnosis`} title={IMPACT_QUESTIONS[qi]!} onBack={qi === 0 ? onBack : () => setQi(qi - 1)}>
      {qi === 0 && <p className="hint">Think about the last two weeks. There are no right answers.{last ? ` Last checked ${formatDate(last.at)}.` : ""}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!complete) return;
          const a = answers as number[];
          update((d) => ({ ...d, impactChecks: [...d.impactChecks, { at: new Date().toISOString(), answers: a }] }));
          setResult(impactGuidance(a));
        }}
      >
        {IMPACT_QUESTIONS.map((q, i) => (
          <fieldset key={q} className="impact-q" hidden={i !== qi}>
            <legend className="sr-only">{q}</legend>
            <div className="options">
              {IMPACT_SCALE.map((label, v) => (
                <label key={label} className={answers[i] === v ? "option on" : "option"}>
                  <input type="radio" name={`impact-${i}`} checked={answers[i] === v} onChange={() => setAnswers((xs) => xs.map((x, j) => (j === i ? v : x)))} />
                  {label}
                </label>
              ))}
            </div>
            {last && <p className="hint small-hint">Last time: {IMPACT_SCALE[last.answers[i] ?? 0]}</p>}
          </fieldset>
        ))}
        <div className="actions sticky">
          {qi < IMPACT_QUESTIONS.length - 1 ? (
            <button className="primary" type="button" disabled={answers[qi] == null} onClick={() => setQi(qi + 1)}>
              Next
            </button>
          ) : (
            <button className="primary" type="submit" disabled={!complete}>
              See guidance
            </button>
          )}
        </div>
      </form>
    </SubScreen>
  );
}
