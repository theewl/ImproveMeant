// Deterministic text utilities: counting, normalisation and quote verification.

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9'%$\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears (after normalisation) in `text`. Ellipses split the quote into parts that must each appear in order. */
export function quoteAppearsIn(quote: string, text: string): boolean {
  const hay = normalizeForMatch(text);
  const parts = quote
    .split(/\.\.\.|…/)
    .map(normalizeForMatch)
    .filter((p) => p.length > 0);
  if (parts.length === 0) return false;
  let from = 0;
  for (const p of parts) {
    const idx = hay.indexOf(p, from);
    if (idx < 0) return false;
    from = idx + p.length;
  }
  return true;
}

export function wordCount(s: string): number {
  const m = s.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
  return m ? m.length : 0;
}

export function sentenceCount(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const parts = t.split(/(?<=[.!?])\s+/).filter((p) => wordCount(p) > 0);
  return Math.max(1, parts.length);
}

export function firstSentence(s: string): string {
  const t = s.trim();
  const m = t.match(/^.*?[.!?](\s|$)/s);
  return (m ? m[0] : t).trim();
}

/** Truncate to max chars on a word boundary; reports whether truncation happened. */
export function boundText(s: string, max: number): { text: string; truncated: boolean } {
  if (s.length <= max) return { text: s, truncated: false };
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return { text: (lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd(), truncated: true };
}

/** Rough token estimate (~4 chars/token for English). Used only for budget pre-checks. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}
