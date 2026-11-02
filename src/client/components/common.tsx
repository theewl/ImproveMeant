import { useEffect, useRef, type ReactNode } from "react";
import type { FeedKind, SourceMeta, StoryKind } from "../../shared/types";

const FEED_BADGE: Record<FeedKind, string> = { news: "In the news", trending: "Widely read", featured: "Featured", timeless: "Timeless", search: "Your topic", own: "Your material" };
import { ApiRequestError } from "../lib/api";
import { href } from "../lib/router";

/** Only http(s) URLs are rendered as links; anything else is dropped. */
export function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function formatDate(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s; // human label for evergreen items
  const d = new Date(s.length === 10 ? s + "T12:00:00Z" : s);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** One quiet line: label · publisher · date · source link. */
export function SourceLine({ source, kind, feed, minutes }: { source: SourceMeta; kind: StoryKind; feed?: FeedKind; minutes?: number }) {
  return (
    <p className="meta-line">
      <span className={kind === "current" ? "kind current" : "kind"}>{feed ? FEED_BADGE[feed] : kind === "current" ? "Current" : "Evergreen"}</span>
      <span>{source.publisher}</span>
      <span>{formatDate(source.publishedAt)}</span>
      {minutes ? <span>{minutes} min</span> : null}
      {safeHref(source.url) && (
        <a href={safeHref(source.url)} target="_blank" rel="noopener noreferrer">
          Source<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </p>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorNotice({ error, onRetry, children }: { error: unknown; onRetry?: () => void; children?: ReactNode }) {
  const e = error as ApiRequestError;
  const retryable = e instanceof ApiRequestError ? e.retryable : true;
  return (
    <div className="notice error" role="alert">
      <p>{e?.message ?? "Something went wrong."}</p>
      <div className="row">
        {onRetry && retryable && (
          <button className="secondary" type="button" onClick={onRetry}>
            Try again
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

/** Hide the tab bar while a practice session is in progress. */
export function useFocusMode(on = true) {
  useEffect(() => {
    if (!on) return;
    document.body.dataset.focus = "1";
    return () => {
      delete document.body.dataset.focus;
    };
  }, [on]);
}

/** Session chrome: exit button + slim progress bar. */
export function SessionTop({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="session-top">
      <a className="icon-btn" href={href({ name: "today" })} aria-label={`Exit ${label}`}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </a>
      <div className="progress" role="progressbar" aria-label={`${label} progress`} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
        <div className="progress-fill" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}

/** Screen heading that receives focus when the step changes (for keyboard and screen-reader users). */
export function StepHeader({ title, eyebrow }: { title: string; eyebrow?: string }) {
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h.current?.focus({ preventScroll: true });
  }, [title]);
  return (
    <header className="step-header">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 tabIndex={-1} ref={h}>
        {title}
      </h2>
    </header>
  );
}
