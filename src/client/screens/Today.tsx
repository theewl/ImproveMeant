import { useEffect, useState } from "react";
import type { StoryCard } from "../../shared/types";
import { dueQueue } from "../../shared/schedule";
import { localDayKey } from "../../shared/dates";
import { ALL_INTERESTS } from "../../shared/evergreen";
import { api, type LiveFeedState } from "../lib/api";
import { useApp } from "../lib/store";
import { href } from "../lib/router";
import { ErrorNotice, Loading, SourceLine } from "../components/common";
import { PlanCard } from "../components/PlanCard";

export function Today() {
  const { data } = useApp();
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

  const today = localDayKey();
  const { queue } = dueQueue(data.reviews, new Date().toISOString());
  const doneToday = data.sessions.filter((s) => s.completedAt && localDayKey(s.completedAt) === today).length;
  const max = data.prefs.sessionMinutes === 3 ? 3 : 4;
  const [featured, ...rest] = cards?.slice(0, max) ?? [];
  const interestNames = data.prefs.interests.map((i) => ALL_INTERESTS.find((x) => x.id === i)?.label ?? i);

  return (
    <main className="screen" id="main">
      <h2 className="page-title">{doneToday > 0 ? "Nice work today" : "Today"}</h2>
      <p className="hint">
        {doneToday > 0
          ? `${doneToday} session${doneToday === 1 ? "" : "s"} done. Another is optional.`
          : interestNames.length
            ? `Picked for you: ${interestNames.join(", ")}`
            : "A mix of ideas worth knowing"}
      </p>

      <PlanCard learnStoryId={featured?.id} />

      {queue.length > 0 && (
        <a className="pill-link" href={href({ name: "review" })}>
          <span>
            <strong>
              {queue.length} review{queue.length === 1 ? "" : "s"}
            </strong>{" "}
            ready · about {queue.length} min
          </span>
          <span aria-hidden="true">→</span>
        </a>
      )}

      {live?.status === "stale" && <p className="notice warn">{live.message}</p>}
      {live?.status === "unavailable" && <p className="notice warn">Today's news couldn't load. Showing curated ideas.</p>}
      {error != null && <ErrorNotice error={error} onRetry={load} />}
      {!cards && error == null && <Loading label="Finding today's stories…" />}

      {featured && (
        <article className="featured">
          <SourceLine source={featured.source} kind={featured.kind} minutes={featured.estimatedMinutes} />
          <h3>{featured.title}</h3>
          <p>{featured.description}</p>
          <a className="button primary" href={href({ name: "learn", storyId: featured.id })}>
            Start<span className="sr-only">: {featured.title}</span>
          </a>
        </article>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="more-h">
          <h3 id="more-h" className="section-title">
            Or pick another
          </h3>
          <ul className="rows">
            {rest.map((c) => (
              <li key={c.id} className="row-item">
                <a className="row-title" href={href({ name: "learn", storyId: c.id })}>
                  {c.title}
                </a>
                <p className="row-desc">{c.description}</p>
                <SourceLine source={c.source} kind={c.kind} minutes={c.estimatedMinutes} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <a className="pill-link subtle" href={href({ name: "talk" })}>
        <span>
          <strong>Rehearse a talk</strong> for a meeting or presentation
        </span>
        <span aria-hidden="true">→</span>
      </a>
    </main>
  );
}
