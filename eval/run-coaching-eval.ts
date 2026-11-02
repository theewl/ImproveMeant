// Coaching evaluation runner. Spends money, so it refuses to run without
// explicit flags:  npm run eval:coaching -- --live --yes [--only=case-id]
// Without --live it validates the case file and prints the estimated cost.
// Results are written to eval/results/ for HUMAN review with eval/RUBRIC.md.
// Automated "checks" are smoke checks; they are not a measure of coaching quality.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadConfig, loadDotEnv } from "../src/server/config";
import { ClaudeCoach, sdkTransport } from "../src/server/coach/claude";
import { UsageMeter } from "../src/server/usage";
import { FileStore } from "../src/server/store";
import { evergreenBriefing, stableHash } from "../src/shared/evergreen";
import { fillPrompt, getExercise } from "../src/shared/curriculum";
import type { Feedback, Briefing } from "../src/shared/types";

interface Case {
  id: string;
  kind: "feedback" | "briefing";
  purpose: string;
  storyId?: string;
  exerciseId?: string;
  modality?: "typed" | "spoken";
  response?: string;
  title?: string;
  sourceText?: string;
  checks: Record<string, unknown>;
}

const args = process.argv.slice(2);
const live = args.includes("--live");
const yes = args.includes("--yes");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);

const file = JSON.parse(readFileSync("eval/coaching-cases.json", "utf8")) as { cases: Case[] };
const cases = file.cases.filter((c) => !only || c.id === only);
loadDotEnv();
const cfg = loadConfig();
// Rough worst case per call: ~2.5k input tokens + max output budget.
const perCall = (2500 * cfg.claude.priceInputPerMTok + 5000 * cfg.claude.priceOutputPerMTok) / 1e6;
console.log(`${cases.length} case(s). Model ${cfg.claude.model}. Worst-case estimate ≈ $${(perCall * cases.length).toFixed(2)} (typical is far lower).`);

if (!live) {
  console.log("Dry run only. Re-run with --live --yes to call the API.");
  process.exit(0);
}
if (!yes) {
  console.error("Refusing to spend credits without --yes.");
  process.exit(1);
}
if (!cfg.claude.apiKey) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const usage = new UsageMeter(new FileStore(cfg.dataDir), cfg);
const coach = new ClaudeCoach(cfg, sdkTransport(cfg.claude.apiKey), usage);
const before = (await usage.summary()).month.costUsd;
const results: unknown[] = [];

for (const c of cases) {
  try {
    if (c.kind === "feedback") {
      const exercise = getExercise(c.exerciseId!);
      const briefing = evergreenBriefing(c.storyId!) as Briefing;
      const fb = await coach.feedback({
        exercise,
        taskPrompt: fillPrompt(exercise.prompt, { topic: briefing.title }),
        briefing,
        talk: null,
        response: c.response!,
        modality: c.modality ?? "typed",
        transcriptEdited: false,
        assisted: false,
        previous: null,
        followUp: null,
        target: "main",
      });
      results.push({ id: c.id, purpose: c.purpose, response: c.response, output: fb, smokeChecks: checkFeedback(fb, c.checks) });
    } else {
      const b = await coach.briefing({
        storyId: "eval-" + c.id,
        title: c.title!,
        text: c.sourceText!,
        partial: false,
        revision: stableHash(c.sourceText!),
        license: "eval fixture",
        source: { url: "https://example.invalid/eval", publisher: "Eval fixture", publishedAt: "2026-11-01", retrievedAt: new Date().toISOString() },
      });
      const text = JSON.stringify(b).toLowerCase();
      const banned = (c.checks.mustNotMention as string[]) ?? [];
      results.push({ id: c.id, purpose: c.purpose, output: b, smokeChecks: { mustNotMention: banned.every((w) => !text.includes(w)) } });
    }
    console.log(`✓ ${c.id}`);
  } catch (e) {
    results.push({ id: c.id, purpose: c.purpose, error: (e as Error).message });
    console.log(`✗ ${c.id}: ${(e as Error).message}`);
  }
}

const spent = (await usage.summary()).month.costUsd - before;
mkdirSync("eval/results", { recursive: true });
const out = `eval/results/coaching-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(out, JSON.stringify({ model: cfg.claude.model, estimatedCostUsd: spent, results }, null, 2));
console.log(`Estimated cost of this run: $${spent.toFixed(4)}. Results: ${out}`);

function checkFeedback(fb: Feedback, checks: Record<string, unknown>) {
  const r: Record<string, boolean> = {};
  if ("goalMet" in checks) r.goalMet = fb.goalMet === checks.goalMet;
  if (checks.priorityRequired) r.priorityRequired = fb.priority !== null;
  if (checks.offTopic) r.offTopic = fb.offTopic === true;
  if (checks.fidelity) r.fidelity = (checks.fidelity as string[]).includes(fb.fidelity.status);
  if (checks.fidelityNot) r.fidelityNot = !(checks.fidelityNot as string[]).includes(fb.fidelity.status);
  if (checks.opinionNoteExpected) r.opinionNote = !!fb.opinionNote;
  if (checks.mustNotMention) {
    const text = JSON.stringify(fb).toLowerCase();
    r.mustNotMention = (checks.mustNotMention as string[]).every((w) => !text.includes(w));
  }
  return r;
}
