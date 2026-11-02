import { useCallback, useEffect, useRef, useState } from "react";
import type { Attempt, Feedback, PracticeSession } from "../../shared/types";
import type { AttemptDraft } from "../components/ResponseCapture";
import { api, type FeedbackBody } from "./api";
import { audioStore } from "./audioStore";
import { upsertSession } from "./state";
import { uid } from "./storage";
import { useApp } from "./store";

/**
 * Shared session state for both practice modes: builds attempts, requests
 * feedback with an idempotency key (one per attempt), and persists the session.
 */
export function useSession(init: () => PracticeSession) {
  const { update } = useApp();
  const [session, setSession] = useState<PracticeSession>(init);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const inflight = useRef(false);
  const started = useRef(false);

  // Persist whenever the session has content.
  useEffect(() => {
    if (session.attempts.length === 0 && !started.current) return;
    started.current = true;
    update((d) => upsertSession(d, session));
  }, [session, update]);

  const makeAttempt = useCallback(async (draft: AttemptDraft, opts: { isRetry: boolean; assisted: boolean }): Promise<Attempt> => {
    const id = uid("a-");
    let savedAudioKey: string | undefined;
    if (draft.keepAudio && draft.audioBlob) {
      try {
        savedAudioKey = await audioStore.save(`audio-${id}`, draft.audioBlob);
      } catch {
        savedAudioKey = undefined; // storage unavailable; continue without saving
      }
    }
    return {
      id,
      createdAt: new Date().toISOString(),
      modality: draft.modality,
      text: draft.text,
      originalTranscript: draft.originalTranscript,
      transcriptEdited: draft.transcriptEdited,
      transcriptSource: draft.transcriptSource,
      assisted: opts.assisted,
      isRetry: opts.isRetry,
      durationSeconds: draft.durationSeconds,
      delivery: draft.delivery,
      savedAudioKey,
      selfView: draft.selfView,
    };
  }, []);

  /** Request feedback for an attempt. Returns null on failure (error is set; nothing is substituted). */
  const getFeedback = useCallback(async (attempt: Attempt, body: Omit<FeedbackBody, "idempotencyKey" | "response">): Promise<Feedback | null> => {
    if (inflight.current) return null; // duplicate submission guard
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api.feedback({
        ...body,
        idempotencyKey: attempt.id,
        response: { text: attempt.text, modality: attempt.modality, transcriptEdited: attempt.transcriptEdited, assisted: attempt.assisted },
      });
      if (res.feedback.kind === "live") setSession((s) => ({ ...s, usedLive: true }));
      return res.feedback;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, []);

  /** Add an attempt, or replace it in place if it already exists (keeps ordering stable). */
  const addAttempt = useCallback(
    (a: Attempt) => setSession((s) => (s.attempts.some((x) => x.id === a.id) ? { ...s, attempts: s.attempts.map((x) => (x.id === a.id ? a : x)) } : { ...s, attempts: [...s.attempts, a] })),
    [],
  );

  const rateAttempt = useCallback(
    (id: string, feedbackRating: Attempt["feedbackRating"], feedbackRatingReason?: Attempt["feedbackRatingReason"]) =>
      setSession((s) => {
        const patch = (a: Attempt): Attempt => (a.id === id ? { ...a, feedbackRating, feedbackRatingReason: feedbackRating === "not-useful" ? feedbackRatingReason : undefined } : a);
        return { ...s, attempts: s.attempts.map(patch), followUps: s.followUps.map((f) => (f.answer ? { ...f, answer: patch(f.answer) } : f)) };
      }),
    [],
  );

  const finish = useCallback(() => setSession((s) => ({ ...s, completedAt: s.completedAt ?? new Date().toISOString() })), []);

  return { session, setSession, busy, setBusy, error, setError, makeAttempt, getFeedback, addAttempt, rateAttempt, finish };
}
