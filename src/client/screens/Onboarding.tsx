import { useState } from "react";
import type { CommunicationGoal, Interest, SessionLength } from "../../shared/types";
import { ALL_INTERESTS } from "../../shared/evergreen";
import { useApp } from "../lib/store";
import { navigate } from "../lib/router";

export const GOALS: { id: CommunicationGoal; label: string }[] = [
  { id: "meetings", label: "Speak up clearly in meetings" },
  { id: "presentations", label: "Give better presentations" },
  { id: "explaining", label: "Explain ideas without rambling" },
  { id: "persuading", label: "Make a persuasive case" },
];

export function PreferencesForm({ submitLabel, onDone, secondary }: { submitLabel: string; onDone: () => void; secondary?: React.ReactNode }) {
  const { data, update } = useApp();
  const [interests, setInterests] = useState<Interest[]>(data.prefs.interests);
  const [goal, setGoal] = useState<CommunicationGoal>(data.prefs.goal);
  const [len, setLen] = useState<SessionLength>(data.prefs.sessionMinutes);

  const toggle = (i: Interest) =>
    setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : xs.length >= 3 ? xs : [...xs, i]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        update((d) => ({ ...d, prefs: { ...d.prefs, interests, goal, sessionMinutes: len, onboarded: true } }));
        onDone();
      }}
    >
      <fieldset>
        <legend className="label">Pick up to three interests</legend>
        <div className="chips">
          {ALL_INTERESTS.map((i) => {
            const on = interests.includes(i.id);
            return (
              <button key={i.id} type="button" className={on ? "chip on" : "chip"} aria-pressed={on} disabled={!on && interests.length >= 3} onClick={() => toggle(i.id)}>
                {i.label}
              </button>
            );
          })}
        </div>
        <p className="hint" aria-live="polite">
          {interests.length}/3 selected
        </p>
      </fieldset>
      <fieldset className="choices">
        <legend className="label">Your main goal</legend>
        {GOALS.map((g) => (
          <label key={g.id} className="choice">
            <input type="radio" name="goal" checked={goal === g.id} onChange={() => setGoal(g.id)} />
            {g.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="choices inline">
        <legend className="label">Session length</legend>
        {([3, 5] as const).map((m) => (
          <label key={m} className="choice">
            <input type="radio" name="len" checked={len === m} onChange={() => setLen(m)} />
            About {m} minutes
          </label>
        ))}
      </fieldset>
      <div className="actions">
        <button className="primary" type="submit">
          {submitLabel}
        </button>
        {secondary}
      </div>
    </form>
  );
}

export function Onboarding() {
  const { update } = useApp();
  return (
    <main className="screen" id="main">
      <h2>Welcome</h2>
      <p className="lede">Short sessions: read something interesting, explain it in your own words, get one specific tip, and try again.</p>
      <PreferencesForm
        submitLabel="Start"
        onDone={() => navigate({ name: "today" })}
        secondary={
          <button
            type="button"
            className="link"
            onClick={() => {
              update((d) => ({ ...d, prefs: { ...d.prefs, onboarded: true } }));
              navigate({ name: "today" });
            }}
          >
            Skip for now
          </button>
        }
      />
    </main>
  );
}
