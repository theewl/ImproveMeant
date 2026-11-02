# Clearline (working name)

**Stay informed. Remember what matters. Have something to say.**

Clearline is a mobile-first practice app for people who know what they mean but ramble. Each short session follows the same loop:

1. Read a sourced briefing.
2. Explain it from memory, out loud or in writing.
3. Get one specific piece of coaching.
4. Try again if you want.
5. Review it later in a new context.

You can also rehearse a short talk in front of a simulated audience that asks you questions.

This is a **private MVP**. For the product plan, evidence, roadmap and backlog, see [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).

## Quick start

You need Node 20 or later.

```bash
npm install
npm run dev        # client http://localhost:5173 (proxies /api to the server on :8787)
```

Open http://localhost:5173. Without credentials, the app runs in **demo mode**:

- Stories come from the curated evergreen library.
- Feedback is a clearly labelled *illustrative example*. It does not evaluate your answer.
- Audience questions come from a reviewed sample bank.
- Recording and playback still work where the browser supports them.
- If transcription isn't configured, you type what you said.

For a production build:

```bash
npm run build && npm start   # serves dist/client + API on http://127.0.0.1:8787
```

## Using it on your phone

Phone browsers only allow the microphone on HTTPS pages, so open the app through an HTTPS tunnel to your computer.

1. In `.env`, set `APP_ACCESS_TOKEN` to a long random password. Without it, the server refuses tunnelled requests whenever an API key is configured, so nobody else can spend your credits.
2. Build and start the app on one port:
   ```bash
   npm run build && npm start        # http://127.0.0.1:8787
   ```
3. Start a tunnel in a second terminal. For example, with [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (free, no account needed):
   ```bash
   cloudflared tunnel --url http://localhost:8787
   ```
   It prints an `https://….trycloudflare.com` address.
4. Open that address on your phone. Go to **Settings → Access token**, enter your password, and allow the microphone when asked.

While the tunnel is running, the address is public, and the token is what protects it. Stop the tunnel (Ctrl+C) when you're done. Your phone keeps its own practice history, separate from your computer's.

## Live providers (optional)

Copy `.env.example` to `.env` and fill in only what you have. Keys stay on the server.

| Capability | Variables | Notes |
|---|---|---|
| Coaching, briefings, audience questions | `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` (default `claude-opus-5-5`), `CLAUDE_EFFORT_*` | Live news is offered only when this is set |
| Live news | `LIVE_CONTENT=wikimedia`, `CONTENT_USER_AGENT` | Wikipedia "In the news" (CC BY-SA 4.0). No key needed |
| Transcription | `DEEPGRAM_API_KEY`, `DEEPGRAM_MODEL` | Audio is sent only after the user agrees. `mip_opt_out=true` is always sent |
| Cost controls | `USAGE_*`, `CLAUDE_PRICE_*`, `TRANSCRIPTION_PRICE_PER_MINUTE_USD` | Limits are enforced on the server. Prices are assumptions; check them |
| Access control | `APP_ACCESS_TOKEN` | Required to bind to a non-loopback host when paid providers are configured |

Setup steps for each provider are in [`docs/PROVIDERS.md`](docs/PROVIDERS.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Server (tsx watch) and Vite dev server |
| `npm run build` | Type-check and build the client |
| `npm start` | Production server (serves the built client and API on one port) |
| `npm test` | Vitest: unit, API, jsdom journey and security tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run eval:coaching` | Coaching evaluation. Runs dry by default; `-- --live --yes` calls the API (about $0.30–0.90). See [`eval/RUBRIC.md`](eval/RUBRIC.md) |

## Layout

```
src/shared/   domain types, reviewed curriculum, evergreen library, scheduling, measurement (no Node/DOM)
src/server/   Hono API, config, usage limits, dedupe, Claude/demo coaches, content + transcription adapters
src/client/   React app: screens, recorder, response capture, feedback/compare panels, local storage
tests/        unit, API (fake providers), jsdom journeys against the in-process server, secret-leak check
eval/         coaching eval cases + human rubric + opt-in live runner
docs/         master plan, provider setup, pilot plan, research notes
```

## Data and privacy (MVP limits)

- **Local only.** Preferences, transcripts, feedback, history and review dates are saved in this browser's `localStorage`. Nothing is synced or backed up, and clearing site data removes it.
- **Audio is not saved by default.** If you tick "Keep this recording", it is stored in IndexedDB on this device and can be deleted.
- **What leaves the device when live providers are on:**
  - Answer text goes to Anthropic.
  - Audio goes to Deepgram, and only when you choose to transcribe.
- **What the server keeps:**
  - Usage counts and cost estimates, with no answer text.
  - Shared story briefings, with no personal data.
- **Settings → Delete all history** clears local data and saved recordings. It can't recall data already processed by providers, which is handled under their own retention policies.

This is not production-ready. The missing pieces are listed in the master plan (§5, "Production requirements not yet implemented").
