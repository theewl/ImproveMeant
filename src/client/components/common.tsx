import { useEffect, useRef, type ReactNode } from "react";
import type { SourceMeta, StoryKind } from "../../shared/types";
import { ApiRequestError } from "../lib/api";

export function formatDate(s: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return s; // human label for evergreen items
  const d = new Date(s.length === 10 ? s + "T12:00:00Z" : s);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SourceLine({ source, kind }: { source: SourceMeta; kind: StoryKind }) {
  return (
    <p className="source">
      <span className={kind === "current" ? "tag current" : "tag evergreen"}>{kind === "current" ? "Current" : "Evergreen"}</span>{" "}
      <span>{source.publisher}</span> · <span>{kind === "current" ? `In the news ${formatDate(source.publishedAt)}` : formatDate(source.publishedAt)}</span>
      {source.sourceUpdatedAt && kind === "current" ? <span> · source last edited {formatDate(source.sourceUpdatedAt)}</span> : null} ·{" "}
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        Original source<span className="sr-only"> (opens in a new tab)</span>
      </a>
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

export function StepHeader({ step, total, title }: { step: number; total: number; title: string }) {
  const h = useRef<HTMLHeadingElement>(null);
  // Move focus to the new step's heading once per step, for screen-reader and keyboard users.
  useEffect(() => {
    h.current?.focus({ preventScroll: true });
  }, [step, title]);
  return (
    <header className="step-header">
      <p className="step-count">
        Step {step} of {total}
      </p>
      <h2 tabIndex={-1} ref={h}>
        {title}
      </h2>
    </header>
  );
}
