import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "vite";
import { loadConfig } from "../src/server/config";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe("server-only credentials", () => {
  it("client and shared code never read environment variables or import server modules", () => {
    for (const f of [...files("src/client"), ...files("src/shared")]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/process\.env|import\.meta\.env/);
      expect(src, f).not.toMatch(/from ["'][./]*server\//);
      expect(src, f).not.toMatch(/@anthropic-ai\/sdk/);
    }
  });

  it("a production client build contains no provider keys even when they are set", async () => {
    const out = mkdtempSync(join(tmpdir(), "clearline-build-"));
    const secrets = { ANTHROPIC_API_KEY: "sk-ant-TESTSECRET-123", DEEPGRAM_API_KEY: "dg-TESTSECRET-456", APP_ACCESS_TOKEN: "tok-TESTSECRET-789" };
    const saved = { ...process.env };
    Object.assign(process.env, secrets);
    try {
      await build({ logLevel: "silent", build: { outDir: out, emptyOutDir: true } });
      const bundle = files(out).map((f) => readFileSync(f, "utf8")).join("\n");
      for (const v of Object.values(secrets)) expect(bundle).not.toContain(v);
      expect(bundle).not.toMatch(/ANTHROPIC_API_KEY|DEEPGRAM_API_KEY/);
    } finally {
      process.env = saved;
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  it("treats placeholder values from .env.example as missing credentials", () => {
    const cfg = loadConfig({ ANTHROPIC_API_KEY: "your-anthropic-api-key", DEEPGRAM_API_KEY: "" } as NodeJS.ProcessEnv);
    expect(cfg.claude.apiKey).toBeNull();
    expect(cfg.transcription.deepgramApiKey).toBeNull();
  });

  it(".env.example contains placeholders only", () => {
    const ex = readFileSync(".env.example", "utf8");
    for (const line of ex.split("\n").filter((l) => /_(KEY|TOKEN)=/.test(l))) {
      expect(line).toMatch(/=(your-[a-z-]+)?$/);
    }
  });
});
