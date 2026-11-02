import { useEffect, useState } from "react";
import type { StoryCard } from "../../shared/types";
import { dueQueue } from "../../shared/schedule";
import { api, type LiveFeedState } from "../lib/api";
import { useApp } from "../lib/store";
import { href } from "../lib/router";
import { ErrorNotice, Loading, SourceLine } from "../components/common";

export function Today() {
  const { data, status } = useApp();
  const [cards, setCards] = useState<StoryCard[] | null>(null);
  const [live, setLive] = useState<LiveFeedState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const interestsKey = data.prefs.interests.join(",");

  const load = () => {
    setError(null);
    setCards(null);
    api
      .stories(data.prefs.interests)
      .then((r) => {
        setCards(r.cards);
        setLive(r.live);
      })
      .catch(setError);
  };
  useEffect(load, [interestsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { queue } = dueQueue(data.reviews, new Date().toISOString());
  const completedToday = data.sessions.filter((s) => s.completedAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const maxCards = data.prefs.sessionMinutes === 3 ? 3 : 5;

  return (
    <main className="screen" id="main">
      <h2 className="sr-only">Today</h2>
      <p className="lede">Stay informed. Remember what matters. Have something to say.</p>

      {completedToday > 0 && (
        <p className="notice ok" role="status">
          You've finished {completedToday} session{completedToday === 1 ? "" : "s"} today. Another is optional.
        </p>
      )}

      {queue.length > 0 && (
        <a className="card due" href={href({ name: "review" })}>
          <strong>
            {queue.length} review{queue.length === 1 ? "" : "s"} ready
          </strong>
          <span className="hint block">About a minute each. Recall first, then check.</span>
        </a>
      )}

      <section aria-labelledby="pick-h">
        <h3 id="pick-h">Pick one to explain</h3>
        <p className="hint">
          {data.prefs.interests.length
            ? "Chosen from your interests. You can change them in Settings."
            : "A mix of curated ideas. Add interests in Settings for a more personal selection."}
        </p>
        {live?.status === "stale" && <p className="notice warn">{live.message}</p>}
        {live?.status === "unavailable" && <p className="notice warn">{live.message} Showing curated ideas only.</p>}
        {live?.status === "disabled" && status?.mode === "demo" && (
          <p className="hint">Current news appears when AI briefings are configured. Curated evergreen ideas are always available.</p>
        )}
        {error != null && <ErrorNotice error={error} onRetry={load} />}
        {!cards && error == null && <Loading label="Finding today's stories…" />}
        {cards && cards.length === 0 && <p>No stories available right now.</p>}
        {cards && (
          <ul className="cards">
            {cards.slice(0, maxCards).map((c) => (
              <li key={c.id} className="card story">
                <h4>
                  <a href={href({ name: "learn", storyId: c.id })}>{c.title}</a>
                </h4>
                <p>{c.description}</p>
                <SourceLine source={c.source} kind={c.kind} />
                <p className="meta">
                  <span>About {c.estimatedMinutes} min</span>
                  <span>{c.whySelected}</span>
                  {c.kind === "current" && !c.briefingReady && <span>Briefing will be generated when you open it</span>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <a className="card talk-cta" href={href({ name: "talk" })}>
        <strong>Rehearse a talk</strong>
        <span className="hint block">Introduce yourself, explain an idea, propose a change, or persuade — to a simulated audience.</span>
      </a>
    </main>
  );
}
