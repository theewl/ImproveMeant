import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { timingSafeEqual, createHash } from "node:crypto";
import { z } from "zod";
import type { AppStatus, Interest } from "../shared/types";
import { fillPrompt, getExercise, getScenario, EXERCISES } from "../shared/curriculum";
import { wordCount } from "../shared/text";
import { ALL_INTERESTS } from "../shared/evergreen";
import type { Config } from "./config";
import type { CoachProvider } from "./coach/types";
import type { ContentService } from "./content/service";
import type { Deduper } from "./dedupe";
import { AppError, notConfigured } from "./errors";
import type { TranscriptionProvider } from "./transcription/deepgram";
import type { UsageMeter } from "./usage";

export interface AppDeps {
  cfg: Config;
  coach: CoachProvider;
  content: ContentService;
  transcription: TranscriptionProvider | null;
  usage: UsageMeter;
  dedupe: Deduper;
  log?: (line: string) => void;
}

const TalkSetupSchema = z.object({
  scenarioId: z.enum(["introduce", "explain-group", "propose-change", "persuade"]),
  audience: z.string().max(200),
  audienceKnowledge: z.enum(["new-to-topic", "some-familiarity", "experts"]),
  outcome: z.string().max(200),
  topic: z.string().max(300),
  notes: z.string().max(1500),
  targetSeconds: z.union([z.literal(60), z.literal(120), z.literal(180)]),
  questionStyle: z.enum(["supportive", "challenging"]),
  fromStoryId: z.string().max(80).optional(),
});

const idemKey = z.string().min(8).max(100);

export function createApp(deps: AppDeps): Hono {
  const { cfg, coach, content, transcription, usage, dedupe } = deps;
  const log = deps.log ?? ((l: string) => console.log(l));
  const app = new Hono();
  const maxChars = cfg.limits.maxResponseChars;
  const paidConfigured = coach.kind === "claude" || transcription !== null;

  const FeedbackRequest = z.object({
    idempotencyKey: idemKey,
    exerciseId: z.string().refine((id) => EXERCISES.some((e) => e.id === id), "Unknown exercise"),
    mode: z.enum(["learn", "talk"]),
    target: z.enum(["main", "followup"]).default("main"),
    storyId: z.string().max(80).optional(),
    talk: TalkSetupSchema.optional(),
    response: z.object({
      text: z.string(),
      modality: z.enum(["spoken", "typed"]),
      transcriptEdited: z.boolean(),
      assisted: z.boolean(),
    }),
    previous: z.object({ text: z.string().max(maxChars), retryFocus: z.string().max(400).nullable() }).nullable().optional(),
    followUp: z.object({ question: z.string().max(400), answer: z.string().max(maxChars) }).nullable().optional(),
  });

  // Routine request logging: method, path, status, duration. Never bodies, queries or headers.
  app.use("*", async (c, next) => {
    const t0 = Date.now();
    await next();
    log(`${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status} ${Date.now() - t0}ms`);
  });

  // Access control for every API route except status/health.
  app.use("/api/*", async (c, next) => {
    const p = new URL(c.req.url).pathname;
    if (p === "/api/status" || p === "/api/health") return next();
    if (!cfg.accessToken) {
      // Without a token, paid endpoints only answer local requests. This catches
      // tunnels and port-forwarding, where the server still listens on loopback.
      if (paidConfigured && isRemoteRequest(c)) {
        return c.json(
          new AppError("unauthorized", "This server can only be used from this computer until APP_ACCESS_TOKEN is set in .env.", 403).toJSON(),
          403,
        );
      }
      return next();
    }
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!safeEqual(token, cfg.accessToken)) {
      return c.json(new AppError("unauthorized", "This server needs an access token. Enter it under Settings.", 401).toJSON(), 401);
    }
    return next();
  });

  app.onError((err, c) => {
    if (err instanceof AppError) return c.json(err.toJSON(), err.status as never);
    if (err instanceof z.ZodError) {
      return c.json(new AppError("bad_request", "Invalid request.", 400).toJSON(), 400);
    }
    log(`error ${new URL(c.req.url).pathname}: ${(err as Error).name}`); // no message: may contain user content
    return c.json(new AppError("provider_error", "Something went wrong on the server.", 500, true).toJSON(), 500);
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/status", (c) => {
    const s = usage.summary();
    const status: AppStatus = {
      mode: coach.kind === "claude" ? "live" : "demo",
      coaching: coach.kind,
      content: content.liveEnabled() ? "wikipedia+evergreen" : "evergreen",
      transcription: transcription ? "deepgram" : "none",
      model: coach.model,
      accessTokenRequired: !!cfg.accessToken,
      limits: { dailyRequests: cfg.limits.dailyRequests, dailyCostUsd: cfg.limits.dailyCostUsd, monthlyCostUsd: cfg.limits.monthlyCostUsd },
      usageToday: { requests: s.today.requests, estimatedCostUsd: round(s.today.costUsd) },
      maxResponseChars: maxChars,
    };
    return c.json(status);
  });

  app.get("/api/usage", (c) => {
    const s = usage.summary();
    return c.json({
      ...s,
      pricingAssumptions: {
        claudeModel: cfg.claude.model,
        inputPerMTokUsd: cfg.claude.priceInputPerMTok,
        outputPerMTokUsd: cfg.claude.priceOutputPerMTok,
        transcriptionPerMinuteUsd: cfg.transcription.pricePerMinuteUsd,
        note: "Costs are estimates from configured prices and provider-reported token counts.",
      },
    });
  });

  app.get("/api/stories", async (c) => {
    const valid = new Set(ALL_INTERESTS.map((i) => i.id));
    const interests = (c.req.query("interests") ?? "")
      .split(",")
      .filter((i): i is Interest => valid.has(i as Interest))
      .slice(0, 3);
    return c.json(await content.listStories(interests));
  });

  app.get("/api/stories/:id/briefing", async (c) => {
    const id = c.req.param("id");
    if (!/^[a-z0-9-]{1,80}$/i.test(id)) throw new AppError("bad_request", "Invalid story id.", 400);
    return c.json(await content.getBriefing(id, { refresh: c.req.query("refresh") === "1" }));
  });

  app.get("/api/stories/:id/status", async (c) => {
    const id = c.req.param("id");
    if (!/^[a-z0-9-]{1,80}$/i.test(id)) throw new AppError("bad_request", "Invalid story id.", 400);
    return c.json(await content.storyStatus(id));
  });

  app.post("/api/feedback", bodyLimit({ maxSize: 64 * 1024, onError: tooLarge }), async (c) => {
    const req = FeedbackRequest.parse(await readJson(c));
    const text = req.response.text.trim();
    if (text.length > maxChars) throw new AppError("too_large", `Responses are limited to ${maxChars} characters.`, 413);
    if (wordCount(text) < 3) throw new AppError("empty_response", "There's nothing to give feedback on yet. Record or type an answer first.", 422);
    const exercise = getExercise(req.exerciseId);
    const briefing = req.storyId ? await content.getBriefing(req.storyId).catch(() => null) : null;
    const talk = req.talk ?? null;
    const topic = talk?.topic || briefing?.title || "";
    const taskPrompt = fillPrompt(exercise.prompt, { topic, audience: talk?.audience });
    const key = `feedback:${req.idempotencyKey}:${hash(JSON.stringify(req))}`;
    const { value, deduplicated } = await dedupe.run(key, () =>
      coach.feedback({
        exercise,
        taskPrompt,
        briefing,
        talk,
        response: text,
        modality: req.response.modality,
        transcriptEdited: req.response.transcriptEdited,
        assisted: req.response.assisted,
        previous: req.previous ?? null,
        followUp: req.followUp ?? null,
        target: req.target,
      }),
    );
    return c.json({ feedback: value, deduplicated });
  });

  const AudienceRequest = z.object({
    idempotencyKey: idemKey,
    talk: TalkSetupSchema,
    response: z.string().max(maxChars),
    previousQuestions: z.array(z.string().max(400)).max(3).default([]),
  });

  app.post("/api/audience-question", bodyLimit({ maxSize: 64 * 1024, onError: tooLarge }), async (c) => {
    const req = AudienceRequest.parse(await readJson(c));
    getScenario(req.talk.scenarioId);
    if (wordCount(req.response) < 3) throw new AppError("empty_response", "Give your talk first; the audience question responds to what you said.", 422);
    const key = `aq:${req.idempotencyKey}:${hash(JSON.stringify(req))}`;
    const { value } = await dedupe.run(key, () => coach.audienceQuestion({ talk: req.talk, response: req.response, previousQuestions: req.previousQuestions }));
    return c.json(value);
  });

  const VariationRequest = z.object({ idempotencyKey: idemKey, exerciseId: z.string(), topic: z.string().min(2).max(200) });
  app.post("/api/variation", bodyLimit({ maxSize: 8 * 1024, onError: tooLarge }), async (c) => {
    const req = VariationRequest.parse(await readJson(c));
    const exercise = getExercise(req.exerciseId);
    const { value } = await dedupe.run(`var:${req.idempotencyKey}:${hash(JSON.stringify(req))}`, () => coach.variation(exercise, req.topic));
    return c.json(value);
  });

  app.post("/api/transcribe", bodyLimit({ maxSize: 12 * 1024 * 1024, onError: tooLarge }), async (c) => {
    if (!transcription) throw notConfigured("Transcription");
    const seconds = Number(c.req.query("seconds") ?? "0");
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 600) throw new AppError("bad_request", "Missing or invalid recording length.", 400);
    const contentType = (c.req.header("content-type") ?? "").split(";")[0]!.trim();
    if (!/^audio\/[a-z0-9.+-]+$/i.test(contentType)) throw new AppError("bad_request", "Unsupported audio type.", 415);
    const key = c.req.header("idempotency-key") ?? "";
    if (key.length < 8) throw new AppError("bad_request", "Missing idempotency key.", 400);
    const buf = new Uint8Array(await c.req.arrayBuffer());
    if (buf.byteLength < 1000) throw new AppError("empty_response", "The recording is empty or too short.", 422, true);
    usage.assertTranscriptionAllowed(seconds);
    const { value } = await dedupe.run(`tx:${key}`, async () => {
      const r = await transcription.transcribe(buf, c.req.header("content-type") ?? contentType, seconds);
      usage.record({
        kind: "transcription",
        provider: "deepgram",
        model: cfg.transcription.model,
        audioSeconds: seconds,
        costUsd: (seconds / 60) * cfg.transcription.pricePerMinuteUsd,
        ok: true,
      });
      return r;
    });
    return c.json(value);
  });

  return app;
}

async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new AppError("bad_request", "Request body must be JSON.", 400);
  }
}

function tooLarge(c: Context) {
  return c.json(new AppError("too_large", "Request is too large.", 413).toJSON(), 413);
}

/** True when the request did not come directly from this machine (other host, or via a proxy/tunnel). */
function isRemoteRequest(c: Context): boolean {
  const host = (c.req.header("host") ?? new URL(c.req.url).host).replace(/:\d+$/, "").toLowerCase();
  const loopbackHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  const proxied = ["x-forwarded-for", "x-forwarded-host", "cf-connecting-ip", "x-real-ip", "forwarded"].some((h) => c.req.header(h));
  return !loopbackHost || proxied;
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 16);
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
