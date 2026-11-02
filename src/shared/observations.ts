import type { Attempt, DeliveryMetrics } from "./types";
import { firstSentence, sentenceCount, wordCount } from "./text";

// Measured, deterministic observations. These are computed by ordinary code,
// never by the model, and each one says exactly what it measured.

export interface MeasuredObservation {
  label: string;
  value: string;
  basis: string;
}

export function measureAttempt(a: Pick<Attempt, "text" | "modality" | "durationSeconds" | "delivery" | "transcriptEdited">): MeasuredObservation[] {
  const out: MeasuredObservation[] = [];
  const words = wordCount(a.text);
  out.push({
    label: "Length",
    value: `${words} words, ${sentenceCount(a.text)} sentence${sentenceCount(a.text) === 1 ? "" : "s"}`,
    basis: a.modality === "spoken" ? (a.transcriptEdited ? "Counted from your edited transcript." : "Counted from the transcript.") : "Counted from your typed answer.",
  });
  const fs = firstSentence(a.text);
  if (fs) {
    out.push({ label: "Opening sentence", value: `${wordCount(fs)} words`, basis: "First sentence as punctuated in the text." });
  }
  const rep = repeatedWords(a.text);
  if (rep.length) {
    out.push({
      label: "Repeated words",
      value: rep.map((r) => `“${r.word}” ×${r.count}`).join(", "),
      basis: "Counted in the text, ignoring common words. Repetition isn't always bad; it's just worth knowing.",
    });
  }
  if (a.modality === "spoken" && a.durationSeconds != null) {
    out.push({ label: "Recording length", value: formatSeconds(a.durationSeconds), basis: "Measured by your browser while recording." });
  }
  if (a.delivery?.basis === "transcription-word-timestamps" && a.delivery.wordsPerMinute != null) {
    out.push({
      label: "Speaking pace",
      value: `about ${Math.round(a.delivery.wordsPerMinute)} words per minute`,
      basis: "From word timestamps returned by the transcription service, on the original (unedited) transcript. Approximate.",
    });
    if (a.delivery.longPauses != null) {
      out.push({
        label: "Gaps over 2 seconds",
        value: String(a.delivery.longPauses),
        basis: "Silences between recognised words. Doesn't distinguish deliberate pauses from hesitation.",
      });
    }
  }
  return out;
}

/** Compute delivery metrics from provider word timestamps. Never from an edited transcript. */
export function deliveryFromWordTimings(words: { start: number; end: number }[], recordingSeconds: number): DeliveryMetrics {
  if (words.length === 0) {
    return {
      basis: "recording-length-only",
      recordingSeconds,
      limitations: "No words were recognised, so pace and pauses can't be measured.",
    };
  }
  const first = words[0]!.start;
  const last = words[words.length - 1]!.end;
  const speakingSeconds = Math.max(0.1, last - first);
  let longPauses = 0;
  for (let i = 1; i < words.length; i++) {
    if (words[i]!.start - words[i - 1]!.end > 2) longPauses++;
  }
  return {
    basis: "transcription-word-timestamps",
    recordingSeconds,
    speakingSeconds,
    wordsPerMinute: (words.length / speakingSeconds) * 60,
    longPauses,
    limitations:
      "Based on automatic word timings, which can be wrong for unclear audio. Doesn't measure pronunciation, pitch, volume, eye contact or confidence.",
  };
}

const STOPWORDS = new Set(
  "a an the and or but so if then than that this these those there here it its it's is are was were be been being am i you we they he she them us our your my me his her their of to in on at for from by with as about into over after before up down out off not no yes do does did doing have has had having can could would should will just very really also more most much many some any all each because when where which who what how why".split(" "),
);

/** Words used three or more times, most frequent first (excluding common function words). Deterministic. */
export function repeatedWords(text: string, max = 3): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []) {
    if (STOPWORDS.has(w) || w.length < 3) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([word, count]) => ({ word, count }));
}

/** Which note lines were covered in the response, by content-word overlap. A rough aid, not a grade. */
export function notesCoverage(notes: string, text: string): { covered: number; total: number; missed: string[] } {
  const lines = notes
    .split(/\n+/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim())
    .filter((l) => l.length > 2);
  const said = new Set((text.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []).filter((w) => !STOPWORDS.has(w) && w.length >= 4));
  const missed: string[] = [];
  let covered = 0;
  for (const line of lines) {
    const words = (line.toLowerCase().match(/[a-z][a-z'’-]*/g) ?? []).filter((w) => !STOPWORDS.has(w) && w.length >= 4);
    if (words.length === 0) continue;
    const hits = words.filter((w) => said.has(w)).length;
    if (hits >= Math.max(1, Math.ceil(words.length / 2))) covered++;
    else missed.push(line);
  }
  return { covered, total: lines.length, missed };
}

export function formatSeconds(s: number): string {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}
