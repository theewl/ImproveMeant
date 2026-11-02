import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServices } from "./services";
import { createApp } from "./app";
import { isLoopback, loadConfig, loadDotEnv } from "./config";

loadDotEnv();
const cfg = loadConfig();

// Refuse to expose paid endpoints on a network interface without access control.
if (!isLoopback(cfg.host) && !cfg.accessToken && (cfg.claude.apiKey || cfg.transcription.deepgramApiKey)) {
  console.error("Refusing to start: HOST is not loopback, paid providers are configured, and APP_ACCESS_TOKEN is not set.");
  process.exit(1);
}

const deps = createServices(cfg);
const app = createApp(deps);

const clientDir = resolve("dist/client");
if ((process.env.NODE_ENV === "production" || process.argv.includes("--serve-client")) && existsSync(clientDir)) {
  app.use("/*", async (c, next) => {
    await next();
    c.header(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    );
    c.header("X-Content-Type-Options", "nosniff");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "microphone=(self), camera=(), geolocation=()");
  });
  app.use("/*", serveStatic({ root: "./dist/client" }));
  app.get("*", (c) => c.html(readFileSync(resolve(clientDir, "index.html"), "utf8")));
}

serve({ fetch: app.fetch, hostname: cfg.host, port: cfg.port }, (info) => {
  console.log(`Server on http://${info.address}:${info.port}`);
  console.log(
    `Mode: coaching=${deps.coach.kind}${deps.coach.model ? ` (${deps.coach.model})` : ""}, content=${deps.content.liveEnabled() ? "wikipedia+evergreen" : "evergreen"}, transcription=${deps.transcription ? "deepgram" : "none"}, access token ${cfg.accessToken ? "required" : "not required"}`,
  );
});
