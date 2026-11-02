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

export function formatSeconds(s: number): string {
  const total = Math.round(s);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
}
