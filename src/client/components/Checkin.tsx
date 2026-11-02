import { useState } from "react";
import type { Experiment } from "../../shared/types";
import { OUTWARD_FOCUS_TIP, SAFETY_BEHAVIOURS } from "../../shared/confidence";
import { CrisisNotice } from "./Crisis";
import { uid } from "../lib/storage";

/**
 * The confidence layer that runs through every session: before, say what you fear and
 * drop one habit; after, rate it and check whether the fear came true. Behavioral
 * experiment in CBT terms; here it is two short forms.
 */
export interface Checkin {
  anxietyBefore: number;
  prediction: string;
  drop?: string;
}

export function BeforeCheckin({ defaultDrop, open = false, onChange }: { defaultDrop?: string; open?: boolean; onChange: (c: Checkin | null) => void }) {
  const [on, setOn] = useState(open);
  const [anx, setAnx] = useState(5);
  const [prediction, setPrediction] = useState("");
  const [drop, setDrop] = useState<string | undefined>(defaultDrop);
  const emit = (next: { on?: boolean; anx?: number; prediction?: string; drop?: string | undefined }) => {
    const o = next.on ?? on;
    const a = next.anx ?? anx;
    const p = next.prediction ?? prediction;
    const dr = "drop" in next ? next.drop : drop;
    onChange(o ? { anxietyBefore: a, prediction: p.trim(), drop: dr } : null);
  };
  return (
    <details
      className="more checkin"
      open={open}
      onToggle={(e) => {
        const o = (e.target as HTMLDetailsElement).open;
        setOn(o);
        emit({ on: o });
      }}
    >
      <summary>Quick check-in (20 seconds)</summary>
      <div className="slider-head">
        <label className="label" htmlFor="pre-anx">
          How anxious do you feel about this?
        </label>
        <output htmlFor="pre-anx">{anx}/10</output>
      </div>
      <input
        id="pre-anx"
        type="range"
        min={0}
        max={10}
        value={anx}
        onChange={(e) => {
          setAnx(Number(e.target.value));
          emit({ anx: Number(e.target.value) });
        }}
      />
      <label className="label" htmlFor="pre-pred">
        What are you worried will happen? (optional)
      </label>
      <input
        id="pre-pred"
        value={prediction}
        maxLength={300}
        placeholder="e.g. I'll lose my thread halfway"
        onChange={(e) => {
          setPrediction(e.target.value);
          emit({ prediction: e.target.value });
        }}
      />
      <CrisisNotice texts={[prediction]} />
      <fieldset className="pills">
        <legend className="label">Optional: drop one habit this time</legend>
        {SAFETY_BEHAVIOURS.map((b) => (
          <label key={b} className={drop === b ? "pill on" : "pill"}>
            <input
              type="radio"
              name="pre-drop"
              checked={drop === b}
              onChange={() => {
                setDrop(b);
                emit({ drop: b });
              }}
              onClick={() => {
                if (drop === b) {
                  setDrop(undefined);
                  emit({ drop: undefined });
                }
              }}
            />
            {b}
          </label>
        ))}
      </fieldset>
      <p className="focus-tip">{OUTWARD_FOCUS_TIP}</p>
      <p className="focus-tip">
        Nerves and excitement feel similar in the body. Some people find it helps to say <strong>“I'm excited”</strong> out loud instead of trying to calm down. Try it if it fits you.
      </p>
    </details>
  );
}

export function AfterCheckin({ checkin, onSave }: { checkin: Checkin; onSave: (anxietyAfter: number, outcome: NonNullable<Experiment["outcome"]>) => void }) {
  const [after, setAfter] = useState(checkin.anxietyBefore);
  const [outcome, setOutcome] = useState<Experiment["outcome"]>();
  const needsOutcome = !!checkin.prediction;
  return (
    <form
      className="checkin-after"
      onSubmit={(e) => {
        e.preventDefault();
        if (needsOutcome ? outcome : true) onSave(after, outcome ?? "didnt-happen");
      }}
    >
      <p className="eyebrow">
        Before, you felt {checkin.anxietyBefore}/10{checkin.prediction ? ` and worried: “${checkin.prediction}”` : ""}
      </p>
      <div className="slider-head">
        <label className="label" htmlFor="after-anx">
          How anxious did you feel while doing it?
        </label>
        <output htmlFor="after-anx">{after}/10</output>
      </div>
      <input id="after-anx" type="range" min={0} max={10} value={after} onChange={(e) => setAfter(Number(e.target.value))} />
      <fieldset className="pills" hidden={!needsOutcome}>
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
      <button className="secondary" type="submit" disabled={needsOutcome && !outcome}>
        Save check-in
      </button>
    </form>
  );
}

/** Build the experiment record for a session's check-in. */
export function checkinExperiment(p: { kind: Experiment["kind"]; sessionId: string; createdAt: string; situation: string; checkin: Checkin; anxietyAfter: number; outcome: NonNullable<Experiment["outcome"]> }): Experiment {
  const hadPrediction = !!p.checkin.prediction;
  return {
    id: uid("x-"),
    createdAt: p.createdAt,
    kind: p.kind,
    sessionId: p.sessionId,
    situation: p.situation,
    prediction: p.checkin.prediction,
    predictionLikelihood: hadPrediction ? 50 : 0,
    anxietyBefore: p.checkin.anxietyBefore,
    safetyBehaviourToDrop: p.checkin.drop,
    completedAt: new Date().toISOString(),
    anxietyAfter: p.anxietyAfter,
    outcome: hadPrediction ? p.outcome : undefined,
  };
}

export function checkinSavedMessage(before: number, after: number, outcome?: Experiment["outcome"]): string {
  const base = outcome === "didnt-happen" ? "What you worried about didn't happen. " : outcome === "partly" ? "Part of it happened and you got through it. " : outcome === "happened" ? "It happened and you got through it. " : "";
  const trend = after < before ? `Anxiety ${before} → ${after}/10.` : after === before ? `Anxiety stayed at ${after}/10; a step still counts.` : `Anxiety ${before} → ${after}/10. Harder than expected, and you still did it.`;
  return `${base}${trend} Logged under Steps.`;
}
