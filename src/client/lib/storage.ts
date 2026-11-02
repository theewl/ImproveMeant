import type { GuidedPlan, Experiment, LadderStep, Preferences, PracticeSession, RealWorldAttempt, Reframe, ReviewItem } from "../../shared/types";

// Local persistence for a private single-user MVP.
// Limitations (documented in README): data lives only in this browser profile,
// isn't synced or backed up, and is lost if site data is cleared.

export const STORAGE_KEY = "clearline.v1";

export interface AppData {
  version: 1;
  prefs: Preferences;
  sessions: PracticeSession[];
  reviews: ReviewItem[];
  realWorld: RealWorldAttempt[];
  /** Confidence tools (CBT-informed self-help). */
  experiments: Experiment[];
  ladder: LadderStep[];
  reframes: Reframe[];
  /** Optional 4-week guided plan. */
  plan?: GuidedPlan;
  /** User has seen the "self-help, not therapy" note. */
  confidenceIntroSeen: boolean;
  /** User has acknowledged that audio is sent to the transcription provider. */
  transcriptionConsent: boolean;
}

export const DEFAULT_PREFS: Preferences = { interests: [], goal: "meetings", sessionMinutes: 5, onboarded: false };

export function emptyData(): AppData {
  return {
    version: 1,
    prefs: { ...DEFAULT_PREFS },
    sessions: [],
    reviews: [],
    realWorld: [],
    experiments: [],
    ladder: [],
    reframes: [],
    confidenceIntroSeen: false,
    transcriptionConsent: false,
  };
}

export function loadData(storage: Storage = localStorage): AppData {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (parsed.version !== 1) return emptyData();
    return { ...emptyData(), ...parsed, prefs: { ...DEFAULT_PREFS, ...parsed.prefs } } as AppData;
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData, storage: Storage = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // quota exceeded or storage disabled
  }
}

export function clearData(storage: Storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
}

export function uid(prefix = ""): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix + r;
}
