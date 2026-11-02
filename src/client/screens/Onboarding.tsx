import { useState } from "react";
import type { CommunicationGoal, Interest, SessionLength } from "../../shared/types";
import { ALL_INTERESTS } from "../../shared/evergreen";
import { NICHES, WEEKLY_TARGETS, interestsForNiches, type Niche, type WeeklyTarget } from "../../shared/vlog";
import { useApp } from "../lib/store";
import { navigate } from "../lib/router";

export const GOALS: { id: CommunicationGoal; label: string }[] = [
  { id: "camera", label: "Get comfortable talking to a camera (vlogs, videos)" },
  { id: "meetings", label: "Speak up clearly in meetings" },
  { id: "presentations", label: "Give better presentations" },
  { id: "explaining", label: "Explain ideas without rambling" },
  { id: "persuading", label: "Make a persuasive case" },
];

/** The three questions that shape the app: who you talk to, what about, how often. */
export function VlogSetup({ submitLabel, onDone, secondary, showMore = false }: { submitLabel: string; onDone: () => void; secondary?: React.ReactNode; showMore?: boolean }) {
  const { data, update } = useApp();
  const [viewer, setViewer] = useState(data.prefs.viewerName ?? "");
  const [niches, setNiches] = useState<Niche[]>((data.prefs.niches ?? []) as Niche[]);
  const [weekly, setWeekly] = useState<WeeklyTarget>(data.prefs.weeklyTakes ?? 5);
  const [goal, setGoal] = useState<CommunicationGoal>(data.prefs.goal);
  const [interests, setInterests] = useState<Interest[]>(data.prefs.interests);
  const [len, setLen] = useState<SessionLength>(data.prefs.sessionMinutes);
  const [more, setMore] = useState(false);

  const toggleNiche = (n: Niche) => setNiches((xs) => (xs.includes(n) ? xs.filter((x) => x !== n) : xs.length >= 3 ? xs : [...xs, n]));
  const toggleInterest = (i: Interest) => setInterests((xs) => (xs.includes(i) ? xs.filter((x) => x !== i) : xs.length >= 3 ? xs : [...xs, i]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const derived = interestsForNiches(niches);
        update((d) => ({
          ...d,
          prefs: { ...d.prefs, viewerName: viewer.trim() || undefined, niches, weeklyTakes: weekly, goal, interests: more && interests.length ? interests : derived.length ? derived : d.prefs.interests, sessionMinutes: len, onboarded: true },
        }));
        onDone();
      }}
    >
      <label className="label" htmlFor="viewer">
        Who's your one viewer? A first name.
      </label>
      <input id="viewer" value={viewer} maxLength={40} placeholder="e.g. Sam" onChange={(e) => setViewer(e.target.value)} />
      <p className="hint">You'll talk to them in every take. One person, not “everyone”.</p>

      <fieldset>
        <legend className="label">What will you talk about? Up to three.</legend>
        <div className="chips">
          {NICHES.map((n) => {
            const on = niches.includes(n.id);
            return (
              <button key={n.id} type="button" className={on ? "chip on" : "chip"} aria-pressed={on} disabled={!on && niches.length >= 3} onClick={() => toggleNiche(n.id)}>
                {n.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="pills">
        <legend className="label">Takes a week</legend>
        {WEEKLY_TARGETS.map((t) => (
          <label key={t} className={weekly === t ? "pill on" : "pill"}>
            <input type="radio" name="weekly" checked={weekly === t} onChange={() => setWeekly(t)} />
            {t}
          </label>
        ))}
      </fieldset>

      {showMore && (
        <details className="more" onToggle={(e) => setMore((e.target as HTMLDetailsElement).open)}>
          <summary>More options</summary>
          <fieldset className="choices">
            <legend className="label">Main goal</legend>
            {GOALS.map((g) => (
              <label key={g.id} className="choice">
                <input type="radio" name="goal" checked={goal === g.id} onChange={() => setGoal(g.id)} />
                {g.label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="label">News interests (for things to react to)</legend>
            <div className="chips">
              {ALL_INTERESTS.map((i) => {
                const on = interests.includes(i.id);
                return (
                  <button key={i.id} type="button" className={on ? "chip on" : "chip"} aria-pressed={on} disabled={!on && interests.length >= 3} onClick={() => toggleInterest(i.id)}>
                    {i.label}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="choices inline">
            <legend className="label">Reading session length</legend>
            {([3, 5] as const).map((m) => (
              <label key={m} className="choice">
                <input type="radio" name="len" checked={len === m} onChange={() => setLen(m)} />
                About {m} minutes
              </label>
            ))}
          </fieldset>
        </details>
      )}

      <div className="actions">
        <button className="primary" type="submit">
          {submitLabel}
        </button>
        {secondary}
      </div>
    </form>
  );
}

/** Kept for Settings. */
export function PreferencesForm(p: { submitLabel: string; onDone: () => void; secondary?: React.ReactNode }) {
  return <VlogSetup {...p} showMore />;
}

export function Onboarding() {
  const { update } = useApp();
  return (
    <main className="screen" id="main">
      <h2>One take a day</h2>
      <p className="lede">Talk to one person, for a minute, about one thing. Get one note. Watch yourself get better.</p>
      <VlogSetup
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
