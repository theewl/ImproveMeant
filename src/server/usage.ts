import type { Config } from "./config";
import { AppError } from "./errors";
import type { KeyValueStore } from "./store";

export type UsageKind = "briefing" | "feedback" | "camera_feedback" | "audience_question" | "variation" | "curation" | "transcription";

export interface UsageRecord {
  at: string;
  kind: UsageKind;
  provider: "claude" | "deepgram";
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  audioSeconds?: number;
  costUsd: number;
  /** True when the cost is computed from configured price assumptions (always, today). */
  costIsEstimate: true;
  ok: boolean;
}

interface Ledger {
  records: UsageRecord[];
}

// One ledger per calendar month (UTC): limits only need the current month,
// and it keeps each stored value small.
const keyFor = (iso: string) => `usage-ledger-${iso.slice(0, 7)}`;

/**
 * Server-side usage ledger and limits. Every paid call is checked before it runs
 * (worst-case estimate) and recorded after (actual tokens reported by the provider).
 */
export class UsageMeter {
  constructor(
    private store: KeyValueStore,
    private cfg: Config,
    private now: () => Date = () => new Date(),
  ) {}

  private async ledger(): Promise<Ledger> {
    return (await this.store.read<Ledger>(keyFor(this.now().toISOString()))) ?? { records: [] };
  }

  claudeCost(u: { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number }): number {
    const c = this.cfg.claude;
    // Cache writes are billed above base input price; we approximate at 1.25x input.
    return (
      (u.inputTokens * c.priceInputPerMTok +
        u.outputTokens * c.priceOutputPerMTok +
        (u.cacheReadTokens ?? 0) * c.priceCacheReadPerMTok +
        (u.cacheWriteTokens ?? 0) * c.priceInputPerMTok * 1.25) /
      1_000_000
    );
  }

  async summary(): Promise<{ today: { requests: number; costUsd: number; transcriptionMinutes: number }; month: { requests: number; costUsd: number }; byKind: Record<string, { requests: number; costUsd: number }> }> {
    const now = this.now().toISOString();
    const day = now.slice(0, 10);
    const month = now.slice(0, 7);
    const recs = (await this.ledger()).records;
    const today = recs.filter((r) => r.at.startsWith(day));
    const mon = recs.filter((r) => r.at.startsWith(month));
    const byKind: Record<string, { requests: number; costUsd: number }> = {};
    for (const r of mon) {
      const k = (byKind[r.kind] ??= { requests: 0, costUsd: 0 });
      k.requests++;
      k.costUsd += r.costUsd;
    }
    return {
      today: {
        requests: today.filter((r) => r.provider === "claude").length,
        costUsd: sum(today.map((r) => r.costUsd)),
        transcriptionMinutes: sum(today.map((r) => (r.audioSeconds ?? 0) / 60)),
      },
      month: { requests: mon.length, costUsd: sum(mon.map((r) => r.costUsd)) },
      byKind,
    };
  }

  /** Throws AppError(usage_limit) if a call with this worst-case cost would exceed a limit. */
  async assertClaudeAllowed(worstCaseUsd: number): Promise<void> {
    const s = await this.summary();
    const l = this.cfg.limits;
    if (s.today.requests >= l.dailyRequests) {
      throw new AppError("usage_limit", `Daily AI request limit (${l.dailyRequests}) reached. It resets tomorrow (UTC).`, 429);
    }
    if (s.today.costUsd + worstCaseUsd > l.dailyCostUsd) {
      throw new AppError("usage_limit", `Daily AI spending limit ($${l.dailyCostUsd.toFixed(2)}) would be exceeded. It resets tomorrow (UTC).`, 429);
    }
    if (s.month.costUsd + worstCaseUsd > l.monthlyCostUsd) {
      throw new AppError("usage_limit", `Monthly AI spending limit ($${l.monthlyCostUsd.toFixed(2)}) would be exceeded.`, 429);
    }
  }

  async assertTranscriptionAllowed(seconds: number): Promise<void> {
    const s = await this.summary();
    const limit = this.cfg.limits.dailyTranscriptionMinutes;
    if (s.today.transcriptionMinutes + seconds / 60 > limit) {
      throw new AppError("usage_limit", `Daily transcription limit (${limit} minutes) reached.`, 429);
    }
    if (s.month.costUsd + (seconds / 60) * this.cfg.transcription.pricePerMinuteUsd > this.cfg.limits.monthlyCostUsd) {
      throw new AppError("usage_limit", "Monthly spending limit would be exceeded.", 429);
    }
  }

  async record(r: Omit<UsageRecord, "at" | "costIsEstimate">): Promise<UsageRecord> {
    const rec: UsageRecord = { ...r, at: this.now().toISOString(), costIsEstimate: true };
    const ledger = await this.ledger();
    ledger.records.push(rec);
    await this.store.write(keyFor(rec.at), ledger);
    return rec;
  }
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
