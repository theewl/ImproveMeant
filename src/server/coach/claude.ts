import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import type { Config, Effort } from "../config";
import { AppError } from "../errors";
import type { UsageKind, UsageMeter } from "../usage";
import type { AudienceQuestion, Briefing, Exercise, Feedback } from "../../shared/types";
import { estimateTokens, quoteAppearsIn } from "../../shared/text";
import { stableHash } from "../../shared/evergreen";
import type { SourceDocument } from "../content/types";
import type { AudienceInput, CoachProvider, CurateInput, CuratedTopics, FeedbackInput } from "./types";
import { AudienceQuestionOutput, BriefingOutput, CurateOutput, FeedbackOutput, VariationOutput, clamp } from "./schemas";
import {
  AUDIENCE_SYSTEM,
  BRIEFING_SYSTEM,
  CURATE_SYSTEM,
  curateUser,
  FEEDBACK_SYSTEM,
  VARIATION_SYSTEM,
  audienceUser,
  briefingUser,
  feedbackUser,
  variationUser,
} from "./prompts";

/** The narrow slice of the SDK we use; lets tests inject a fake. */
export interface MessageTransport {
  create(params: Record<string, unknown>, options: { timeout: number; maxRetries: number }): Promise<RawMessage>;
}

export interface RawMessage {
  model?: string;
  stop_reason: string | null;
  content: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  };
}

export function sdkTransport(apiKey: string): MessageTransport {
  const client = new Anthropic({ apiKey });
  return {
    create: (params, options) =>
      client.beta.messages.create(params as never, options) as unknown as Promise<RawMessage>,
  };
}

interface CallSpec<T> {
  kind: UsageKind;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  effort: Effort;
}

const MAX_TOKENS = { briefing: 6000, feedback: 5000, audience_question: 1500, variation: 1200, curation: 1500 } as const;

export class ClaudeCoach implements CoachProvider {
  readonly kind = "claude" as const;
  readonly model: string;

  constructor(
    private cfg: Config,
    private transport: MessageTransport,
    private usage: UsageMeter,
  ) {
    this.model = cfg.claude.model;
  }

  /** One bounded, metered, validated call. */
  async call<T>(spec: CallSpec<T>): Promise<{ data: T; model: string }> {
    const worstCase = this.usage.claudeCost({
      inputTokens: estimateTokens(spec.system + spec.user) + 200,
      outputTokens: spec.maxTokens,
    });
    await this.usage.assertClaudeAllowed(worstCase);

    const format = betaZodOutputFormat(spec.schema as never) as { type: string; schema: unknown };
    const params: Record<string, unknown> = {
      model: this.cfg.claude.model,
      max_tokens: spec.maxTokens,
      system: spec.system,
      messages: [{ role: "user", content: spec.user }],
      thinking: { type: "adaptive" },
      output_config: { effort: spec.effort, format: { type: format.type, schema: format.schema } },
    };
    if (this.cfg.claude.refusalFallback === "default") {
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }

    let msg: RawMessage;
    try {
      msg = await this.transport.create(params, { timeout: this.cfg.claude.timeoutMs, maxRetries: this.cfg.claude.maxRetries });
    } catch (err) {
      await this.usage.record({ kind: spec.kind, provider: "claude", model: this.cfg.claude.model, costUsd: 0, ok: false });
      throw mapSdkError(err);
    }

    const u = msg.usage ?? {};
    const tokens = {
      inputTokens: u.input_tokens ?? 0,
      outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
    };
    const model = msg.model ?? this.cfg.claude.model;
    const okStop = msg.stop_reason === "end_turn" || msg.stop_reason === "stop_sequence";
    await this.usage.record({ kind: spec.kind, provider: "claude", model, ...tokens, costUsd: this.usage.claudeCost(tokens), ok: okStop });

    if (msg.stop_reason === "refusal") {
      throw new AppError("provider_error", "The AI service declined this request. Try rephrasing, or continue without AI feedback.", 502, false);
    }
    if (msg.stop_reason === "max_tokens") {
      throw new AppError("malformed_output", "The AI response was cut off before it finished. You can try again.", 502, true);
    }
    const text = msg.content
      .filter((b) => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new AppError("malformed_output", "The AI response wasn't in the expected format. You can try again.", 502, true);
    }
    const parsed = spec.schema.safeParse(json);
    if (!parsed.success) {
      throw new AppError("malformed_output", "The AI response didn't match the expected structure. You can try again.", 502, true);
    }
    return { data: parsed.data, model };
  }

  async briefing(doc: SourceDocument): Promise<Briefing> {
    const { data, model } = await this.call({
      kind: "briefing",
      system: BRIEFING_SYSTEM,
      user: briefingUser({ title: doc.title, sourceText: doc.text, partial: doc.partial, publisher: doc.source.publisher, date: doc.source.publishedAt }),
      schema: BriefingOutput,
      maxTokens: MAX_TOKENS.briefing,
      effort: this.cfg.claude.effortCoaching,
    });
    return buildBriefing(doc, data, model);
  }

  async feedback(input: FeedbackInput): Promise<Feedback> {
    const { data, model } = await this.call({
      kind: "feedback",
      system: FEEDBACK_SYSTEM,
      user: feedbackUser(input),
      schema: FeedbackOutput,
      maxTokens: MAX_TOKENS.feedback,
      effort: this.cfg.claude.effortCoaching,
    });
    return buildFeedback(data, input.response, model);
  }

  async audienceQuestion(input: AudienceInput): Promise<AudienceQuestion> {
    const { data } = await this.call({
      kind: "audience_question",
      system: AUDIENCE_SYSTEM,
      user: audienceUser(input),
      schema: AudienceQuestionOutput,
      maxTokens: MAX_TOKENS.audience_question,
      effort: this.cfg.claude.effortLight,
    });
    return { kind: "live", question: clamp(data.question, 300), intent: clamp(data.intent, 160) };
  }

  async curateTopics(input: CurateInput): Promise<CuratedTopics> {
    const { data } = await this.call({
      kind: "curation",
      system: CURATE_SYSTEM,
      user: curateUser(input),
      schema: CurateOutput,
      maxTokens: MAX_TOKENS.curation,
      effort: this.cfg.claude.effortLight,
    });
    return {
      picks: data.picks.slice(0, 6).map((p) => ({ title: clamp(p.title, 200), why: clamp(p.why, 140) })),
      suggestions: data.suggestions.slice(0, 3).map((p) => ({ title: clamp(p.title, 120), why: clamp(p.why, 140) })),
    };
  }

  async variation(exercise: Exercise, topic: string): Promise<{ prompt: string; kind: "live" }> {
    const { data } = await this.call({
      kind: "variation",
      system: VARIATION_SYSTEM,
      user: variationUser({ exercise, topic }),
      schema: VariationOutput,
      maxTokens: MAX_TOKENS.variation,
      effort: this.cfg.claude.effortLight,
    });
    return { prompt: clamp(data.prompt, 400), kind: "live" };
  }
}

/** Post-validate a briefing: verify excerpts against the source, clamp lengths. */
export function buildBriefing(doc: SourceDocument, out: BriefingOutput, model: string): Briefing {
  if (!out.sufficient) {
    throw new AppError(
      "insufficient_source",
      `This source doesn't have enough material for a reliable briefing${out.insufficientReason ? `: ${clamp(out.insufficientReason, 200)}` : "."}`,
      422,
    );
  }
  const verified = out.supportingExcerpts.map((e) => clamp(e, 300)).filter((e) => quoteAppearsIn(e, doc.text));
  if (verified.length === 0) {
    throw new AppError(
      "malformed_output",
      "The generated briefing couldn't be matched to the source text, so it wasn't used. You can try again or pick another story.",
      502,
      true,
    );
  }
  const points = out.points.slice(0, 4).map((p) => clamp(p, 320));
  if (points.length < 1 || !out.mainIdea.trim()) {
    throw new AppError("malformed_output", "The generated briefing was incomplete.", 502, true);
  }
  const inContext = out.keyTerm.inContext && quoteAppearsIn(out.keyTerm.inContext, doc.text) ? clamp(out.keyTerm.inContext, 240) : null;
  return {
    storyId: doc.storyId,
    kind: doc.storyId.startsWith("own-") ? "evergreen" : "current",
    title: clamp(out.title || doc.title, 120),
    points,
    mainIdea: clamp(out.mainIdea, 320),
    uncertainty: out.uncertainty ? clamp(out.uncertainty, 400) : null,
    keyTerm: {
      term: clamp(out.keyTerm.term, 60),
      meaning: clamp(out.keyTerm.meaning, 240),
      inContext,
      exampleUse: clamp(out.keyTerm.exampleUse, 240),
    },
    followUpQuestion: clamp(out.followUpQuestion, 300),
    source: doc.source,
    supportingExcerpts: verified.slice(0, 3),
    coverage: doc.partial ? "partial" : "full",
    generatedBy: "claude",
    generatedAt: new Date().toISOString(),
    sourceVersion: doc.revision || stableHash(doc.text),
  };
}

/** Post-validate feedback: drop quotes that don't appear in the response. */
export function buildFeedback(out: FeedbackOutput, response: string, model: string): Feedback {
  let removed = 0;
  const verify = (q: string): string | null => {
    const t = q.trim();
    if (!t) return null;
    if (quoteAppearsIn(t, response)) return clamp(t, 120);
    removed++;
    return null;
  };
  const strength = out.strength ? { observation: clamp(out.strength.observation, 400), quote: verify(out.strength.quote) } : null;
  const priority = out.priority
    ? { observation: clamp(out.priority.observation, 400), quote: verify(out.priority.quote), suggestion: clamp(out.priority.suggestion, 400) }
    : null;
  return {
    kind: "live",
    goalMet: out.offTopic ? false : out.goalMet,
    offTopic: out.offTopic,
    strength,
    priority,
    explanation: clamp(out.explanation, 600),
    fidelity: { status: out.fidelity.status, note: out.fidelity.note ? clamp(out.fidelity.note, 400) : null },
    opinionNote: out.opinionNote ? clamp(out.opinionNote, 400) : null,
    retryFocus: out.retryFocus ? clamp(out.retryFocus, 300) : null,
    unverifiedQuotesRemoved: removed,
    model,
    followUpNote: out.followUpNote ? clamp(out.followUpNote, 300) : null,
  };
}

export function mapSdkError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AppError("provider_timeout", "The AI service took too long to respond. You can try again.", 504, true);
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AppError("provider_error", "The AI service rejected the server's credentials. Check ANTHROPIC_API_KEY.", 502, false);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AppError("provider_error", "The AI service is rate-limiting requests. Wait a minute and try again.", 503, true);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AppError("provider_error", "The AI service rejected the request (configuration problem). Check the server log.", 502, false);
  }
  if (err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError) {
    return new AppError("provider_error", "The AI service is unavailable right now. You can try again.", 503, true);
  }
  return new AppError("provider_error", "The AI request failed unexpectedly. You can try again.", 502, true);
}
