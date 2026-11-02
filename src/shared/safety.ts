// Deterministic check for crisis language in free text the learner writes in
// the confidence tools. It never blocks anything: it only decides whether to
// show crisis resources. It is deliberately broad; a false positive just shows
// a supportive message.

const CRISIS_PATTERNS = [
  /\bkill(ing)?\s+my\s*self\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend\s+(it\s+all|my\s+life)\b/i,
  /\b(want|wanted|wish)\s+(to\s+)?(die|be\s+dead)\b/i,
  /\bself[-\s]?harm(ing)?\b/i,
  /\bhurt(ing)?\s+my\s*self\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
];

export function mentionsCrisis(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => !!t && CRISIS_PATTERNS.some((re) => re.test(t)));
}

export const CRISIS_RESOURCES = [
  { label: "US: call or text 988 (Suicide & Crisis Lifeline)", href: "tel:988" },
  { label: "Find a helpline in your country (findahelpline.com)", href: "https://findahelpline.com" },
  { label: "If you're in immediate danger, call your local emergency number", href: "" },
];
