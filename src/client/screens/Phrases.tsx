import type { KeyTerm, ReviewItem } from "../../shared/types";
import { firstDueDate } from "../../shared/schedule";
import { useApp } from "../lib/store";
import { addReviewItem } from "../lib/state";
import { uid } from "../lib/storage";
import { href } from "../lib/router";
import { formatDate } from "../components/common";

export interface BankEntry {
  term: KeyTerm;
  storyId?: string;
  storyTitle?: string;
  firstSeen: string;
}

/** Distinct phrases met in Learn sessions, most recent first. */
export function phraseBank(sessions: { keyTerm?: KeyTerm; storyId?: string; storyTitle?: string; startedAt: string }[]): BankEntry[] {
  const byTerm = new Map<string, BankEntry>();
  for (const s of [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    if (!s.keyTerm) continue;
    const k = s.keyTerm.term.toLowerCase();
    if (!byTerm.has(k)) byTerm.set(k, { term: s.keyTerm, storyId: s.storyId, storyTitle: s.storyTitle, firstSeen: s.startedAt });
  }
  return [...byTerm.values()].reverse();
}

export function Phrases() {
  const { data, update } = useApp();
  const bank = phraseBank(data.sessions);
  const inReviews = (term: string) => data.reviews.some((r) => r.kind === "phrase" && r.status === "active" && r.prompt.toLowerCase().includes(`"${term.toLowerCase()}"`));

  const add = (e: BankEntry) => {
    const now = new Date().toISOString();
    const item: ReviewItem = {
      id: uid("r-"),
      kind: "phrase",
      createdAt: now,
      prompt: `What does "${e.term.term}" mean?`,
      answer: `${e.term.meaning} Example: ${e.term.exampleUse}`,
      applyTask: `Use "${e.term.term}" in a new sentence about your own work or life.`,
      step: 0,
      dueAt: firstDueDate(now),
      history: [],
      status: "active",
    };
    update((d) => addReviewItem(d, item).data);
  };

  return (
    <main className="screen" id="main">
      <a className="link back" href={href({ name: "progress" })}>
        ← Progress
      </a>
      <h2 className="page-title">Phrase bank</h2>
      <p className="hint">Useful words and phrases from your sessions. The best way to own one is to use it in your own sentence.</p>
      {bank.length === 0 ? (
        <p className="notice">Open a story on Today, explain it, and its phrase will appear here.</p>
      ) : (
        <ul className="phrases">
          {bank.map((e) => (
            <li key={e.term.term} className="phrase">
              <p className="term-word">{e.term.term}</p>
              <p>{e.term.meaning}</p>
              <p className="example">“{e.term.exampleUse}”</p>
              <p className="meta-line">
                <span>{e.storyTitle ?? "Session"}</span>
                <span>{formatDate(e.firstSeen)}</span>
              </p>
              {inReviews(e.term.term) ? (
                <p className="hint">✓ In your reviews</p>
              ) : (
                <button className="secondary small" type="button" onClick={() => add(e)}>
                  Practice in reviews
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
