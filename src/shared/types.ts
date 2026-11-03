// Shared domain types used by both client and server.
// Keep this file free of runtime dependencies on Node or the DOM.

export type SkillId = "main-point" | "organize" | "example" | "conclusion";

export type Interest =
  | "technology"
  | "science"
  | "business"
  | "health"
  | "environment"
  | "culture";

export type CommunicationGoal =
  | "meetings"
  | "presentations"
  | "explaining"
  | "persuading"
  | "camera";

export type SessionLength = 3 | 5;

export interface Preferences {
  interests: Interest[]; // up to three
  goal: CommunicationGoal;
  sessionMinutes: SessionLength;
  onboarded: boolean;
  /** Quiet mode: hide timers and delivery numbers to reduce self-monitoring. */
  quietMode?: boolean;
  /** Optional access token for a protected deployment. Never a provider key. */
  accessToken?: string;
  /** Vlogging: the one person you talk to on camera (a first name). */
  viewerName?: string;
  /** Vlogging niches, up to three. */
  niches?: string[];
  /** Takes per week the learner is aiming for. */
  weeklyTakes?: 3 | 5 | 7;
}

// ---------- Content ----------

export type StoryKind = "current" | "evergreen";
/** Where a live story came from. */
export type FeedKind = "news" | "trending" | "featured" | "timeless" | "search" | "own";

/** Source metadata that must travel with every briefing. */
export interface SourceMeta {
  url: string;
  publisher: string;
  /** ISO date or a human label for evergreen material (e.g. "1975 (original idea)"). */
  publishedAt: string;
  /** ISO timestamp of when we fetched (live) or last reviewed (evergreen) the source. */
  retrievedAt: string;
  /** Last-modified time reported by the source, if any. */
  sourceUpdatedAt?: string;
  /** Who wrote / maintains the source, if known. */
  byline?: string;
}

export interface StoryCard {
  id: string;
  kind: StoryKind;
  feed?: FeedKind;
  title: string;
  description: string;
  interest: Interest;
  source: SourceMeta;
  estimatedMinutes: number;
  /** Plain-language reason this card was selected. */
  whySelected: string;
  /** True when a shared, already-generated briefing exists (no new AI cost to open). */
  briefingReady: boolean;
}

export interface KeyTerm {
  term: string;
  meaning: string;
  /** Short excerpt from the source showing the term in context, if available. */
  inContext: string | null;
  /** An original example sentence showing everyday use. */
  exampleUse: string;
}

export interface Briefing {
  storyId: string;
  kind: StoryKind;
  feed?: FeedKind;
  title: string;
  points: string[];
  mainIdea: string;
  uncertainty: string | null;
  keyTerm: KeyTerm;
  followUpQuestion: string;
  source: SourceMeta;
  /** Short verbatim excerpts from the source that support the briefing. Verified server-side. */
  supportingExcerpts: string[];
  /** "full" when the provider supplied article text; "partial" when we only used part of it. */
  coverage: "full" | "partial" | "curated";
  generatedBy: "curated" | "claude";
  generatedAt: string;
  /** Hash of the source text used. Changes when the source is corrected/updated. */
  sourceVersion: string;
}

// ---------- Curriculum ----------

export type Difficulty = "starter" | "core" | "stretch";

export interface Exercise {
  id: string;
  skill: SkillId;
  difficulty: Difficulty;
  title: string;
  /** What the learner is asked to do. May contain {topic}. */
  prompt: string;
  successDefinition: string;
  exampleFeedback: string;
  /** Same skill tested in a different context, used for later review. */
  laterVariation: string;
}

export type ScenarioId = "introduce" | "explain-group" | "propose-change" | "persuade";

export interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  primarySkill: SkillId;
  exerciseId: string;
  defaultAudience: string;
  defaultOutcome: string;
  /** Reviewed sample questions used in demo mode and as examples for live generation. */
  sampleQuestions: { supportive: string[]; challenging: string[] };
}

// ---------- Attempts & feedback ----------

export type Modality = "spoken" | "typed";

export interface DeliveryMetrics {
  /** Source of the numbers, always shown to the user. */
  basis: "transcription-word-timestamps" | "recording-length-only";
  recordingSeconds: number;
  speakingSeconds?: number;
  wordsPerMinute?: number;
  longPauses?: number; // gaps > 2s between recognized words
  limitations: string;
}

export interface Attempt {
  id: string;
  createdAt: string;
  modality: Modality;
  text: string;
  /** Text as originally transcribed, if the user edited it. */
  originalTranscript?: string;
  transcriptEdited: boolean;
  transcriptSource?: "provider" | "browser-speech" | "typed-by-user";
  /** Learn mode: the user reopened the briefing before/while answering. */
  assisted: boolean;
  isRetry: boolean;
  durationSeconds?: number;
  delivery?: DeliveryMetrics;
  /** Key of a recording saved on this device (IndexedDB), only if user opted in. */
  savedAudioKey?: string;
  /** Observer review (self-reported): how they thought they came across before vs after listening back. 0–10. */
  selfView?: { predicted: number; observed: number };
  feedback?: Feedback;
  /** Learner's rating of the feedback's usefulness (live feedback only). */
  feedbackRating?: "useful" | "not-useful";
  feedbackRatingReason?: "not-specific" | "missed-point" | "too-harsh" | "wrong";
}

export type FidelityStatus = "accurate" | "minor_gaps" | "factual_error" | "not_applicable";

export interface QuotedObservation {
  observation: string;
  /** Verbatim words from the response. Null if the model's quote could not be verified. */
  quote: string | null;
}

/** What the coach can see in a still frame from a camera recording. */
export type CameraAspect = "framing" | "eye-line" | "lighting" | "background" | "expression" | "stability";

export interface CameraNotes {
  /** How many still frames were reviewed (never the video itself). */
  framesReviewed: number;
  observations: { aspect: CameraAspect; observation: string; fix: string | null }[];
}

export interface Feedback {
  /** live = Claude evaluated this response. illustrative = canned example, did NOT evaluate it. */
  kind: "live" | "illustrative";
  /** Camera drills: the opening a viewer hears before deciding to stay. */
  hook?: { observation: string; quote: string | null; rewrite: string | null } | null;
  /** Camera drills: did the take end on a takeaway or a question, or trail off? */
  ending?: { observation: string; quote: string | null } | null;
  /** Camera drills: what the coach saw in a few still frames. Null when no frames were sent. */
  camera?: CameraNotes | null;
  /** Camera drills: the one idea a viewer would take away, in the speaker's words, or null if there isn't one. */
  throughline?: string | null;
  goalMet: boolean | null;
  strength: QuotedObservation | null;
  priority: (QuotedObservation & { suggestion: string }) | null;
  explanation: string;
  fidelity: { status: FidelityStatus; note: string | null };
  opinionNote: string | null;
  retryFocus: string | null;
  /** One sentence about a follow-up answer, when one was evaluated together with the main response. */
  followUpNote?: string | null;
  offTopic: boolean;
  /** Number of model quotes that failed verification and were removed. */
  unverifiedQuotesRemoved: number;
  model?: string;
}

export interface AudienceQuestion {
  kind: "live" | "sample";
  question: string;
  intent: string;
}

export type SessionMode = "learn" | "talk" | "camera";

/** Settings for a talk-to-camera drill. */
export interface CameraSetup {
  drillId: string;
  /** Prompt from the vlog bank, if the take came from one. */
  promptId?: string;
  /** The one idea the viewer should walk away with, in the speaker's words. */
  throughline?: string;
  hookPattern?: string;
  topic: string;
  /** Three talking points shown near the lens (not a script). */
  notes: string;
  /** Self-reported comfort on camera before and after, 0–10. */
  comfortBefore?: number;
  comfortAfter?: number;
  /** Number of still frames sent to the coach with the last attempt. */
  framesSent?: number;
}

export interface TalkSetup {
  scenarioId: ScenarioId;
  audience: string;
  audienceKnowledge: "new-to-topic" | "some-familiarity" | "experts";
  outcome: string;
  topic: string;
  notes: string;
  targetSeconds: 60 | 120 | 180;
  questionStyle: "supportive" | "challenging";
  fromStoryId?: string;
}

export interface PracticeSession {
  id: string;
  mode: SessionMode;
  startedAt: string;
  completedAt?: string;
  storyId?: string;
  storyTitle?: string;
  storySource?: SourceMeta;
  /** Learn mode: the phrase taught in the briefing, for the phrase bank. */
  keyTerm?: KeyTerm;
  exerciseId: string;
  skill: SkillId;
  talk?: TalkSetup;
  camera?: CameraSetup;
  attempts: Attempt[];
  /** Follow-up / audience question answers. */
  followUps: { question: AudienceQuestion; answer?: Attempt }[];
  usedLive: boolean;
}

// ---------- Review ----------

export type ReviewKind = "idea" | "phrase" | "skill";

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  createdAt: string;
  /** What to ask (the cue shown before the answer is revealed). */
  prompt: string;
  /** Reference answer shown after the learner tries to recall. */
  answer: string;
  /** For phrase/skill items: an instruction to apply in a new context. */
  applyTask?: string;
  skill?: SkillId;
  exerciseId?: string;
  storyId?: string;
  storyKind?: StoryKind;
  sourceVersion?: string;
  source?: SourceMeta;
  /** Number of successful recalls so far (for display; scheduling uses `fsrs`). */
  step: number;
  /** FSRS memory state (serialised ts-fsrs Card). Absent for items not yet reviewed. */
  fsrs?: FsrsState;
  dueAt: string;
  lastReviewedAt?: string;
  history: { at: string; result: ReviewResult; response?: string }[];
  status: "active" | "dismissed";
  /** Set when the underlying source changed after this item was saved. */
  sourceChanged?: boolean;
}

export type ReviewResult = "recalled" | "partly" | "missed" | "skipped";

export interface RealWorldAttempt {
  id: string;
  at: string;
  missionId: string;
  note: string;
  /** Self-reported, 1–5. Kept separate from observed performance. */
  comfort?: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  skill?: SkillId;
}

// ---------- API ----------

export interface AppStatus {
  mode: "live" | "demo";
  coaching: "claude" | "demo";
  content: "wikipedia+evergreen" | "evergreen";
  transcription: "deepgram" | "none";
  model?: string;
  accessTokenRequired: boolean;
  limits: { dailyRequests: number; dailyCostUsd: number; monthlyCostUsd: number };
  usageToday: { requests: number; estimatedCostUsd: number };
  maxResponseChars: number;
}

export interface ApiError {
  error: string;
  code:
    | "bad_request"
    | "not_configured"
    | "unauthorized"
    | "usage_limit"
    | "provider_error"
    | "provider_timeout"
    | "malformed_output"
    | "insufficient_source"
    | "not_found"
    | "too_large"
    | "empty_response";
  retryable: boolean;
}

// ---------- Confidence (CBT-informed self-help; not therapy) ----------

export type ThinkingTrap =
  | "mind-reading"
  | "fortune-telling"
  | "catastrophizing"
  | "spotlight"
  | "all-or-nothing"
  | "discounting-positives"
  | "shoulds"
  | "emotional-reasoning"
  | "labeling";

/** "Untangle a thought": a cognitive-restructuring worksheet entry. */
export interface Reframe {
  id: string;
  at: string;
  situation: string;
  thought: string;
  /** How much the learner believed the thought, 0–100 (self-reported). */
  beliefBefore: number;
  traps: ThinkingTrap[];
  evidenceAgainst: string;
  friendAdvice: string;
  balanced: string;
  beliefAfter?: number;
}

/** A rung on the brave-steps ladder (graded exposure). */
export interface LadderStep {
  id: string;
  createdAt: string;
  title: string;
  /** Expected discomfort, 0–10 (self-reported; same scale as anxiety check-ins). */
  expectedDiscomfort: number;
  archived?: boolean;
}

/** A behavioral experiment: predict, do it, compare. */
export interface Experiment {
  id: string;
  createdAt: string;
  kind: "real-world" | "rehearsal" | "camera";
  situation: string;
  ladderStepId?: string;
  sessionId?: string;
  /** What the learner fears will happen. Empty for a rehearsal check-in without a prediction. */
  prediction: string;
  /** How likely they think it is, 0–100. */
  predictionLikelihood: number;
  /** Anxiety before, 0–10 (self-reported). */
  anxietyBefore: number;
  safetyBehaviourToDrop?: string;
  /** Implementation intention: "If <obstacle>, then I will <action>". */
  ifThen?: { obstacle: string; action: string };
  completedAt?: string;
  anxietyAfter?: number;
  outcome?: "happened" | "partly" | "didnt-happen";
  whatHappened?: string;
  wentOkay?: string;
  learned?: string;
}

// ---------- Guided plan ----------

export interface GuidedPlan {
  startedAt: string;
  reflections: { week: number; at: string; text: string }[];
}

export interface FsrsState {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

/** Non-diagnostic "how much does it get in the way?" check-in. Answers 0–4 per question. */
export interface ImpactCheck {
  at: string;
  answers: number[];
}
