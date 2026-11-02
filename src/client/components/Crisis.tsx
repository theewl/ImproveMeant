import { CRISIS_RESOURCES, mentionsCrisis } from "../../shared/safety";

export function CrisisList() {
  return (
    <ul className="plain">
      {CRISIS_RESOURCES.map((r) => (
        <li key={r.label}>
          {r.href ? (
            <a href={r.href} target={r.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
              {r.label}
            </a>
          ) : (
            r.label
          )}
        </li>
      ))}
    </ul>
  );
}

/** Shown when any of the given free-text fields contains crisis language. Never blocks anything. */
export function CrisisNotice({ texts }: { texts: (string | undefined)[] }) {
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
