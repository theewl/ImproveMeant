# Deploying on Vercel

The repo builds its own Vercel output, defined in `vercel.json` and `scripts/build-vercel.mjs`:
- the client is served as static files
- `/api/*` runs as one Node function, capped at 60 seconds
- shared state lives in **Upstash Redis**, because serverless instances don't share disk or memory. That state is the usage ledger behind your spending limits, plus the news briefing cache.

## One-time setup (Vercel dashboard)

1. **Project → Settings → Build and Deployment.**
   - Framework Preset: **Other**.
   - Leave the build and output settings empty or default; `vercel.json` sets them.
   - Node.js version: **22.x**.
2. *(Optional but recommended)* **Project → Storage → add Upstash Redis** (from the Marketplace; free tier is fine) and connect it to this project. This adds `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` automatically. Both naming schemes work.
3. **Project → Settings → Environment Variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your key |
   | `APP_ACCESS_TOKEN` | a long random password (required: without it the API refuses requests from the internet) |
   | `CONTENT_USER_AGENT` | e.g. `ClearlinePersonal/0.1 (you@example.com)` |
   | optional `DEEPGRAM_API_KEY` | for transcription |
   | `SKIP_SHARED_STORAGE` | `true` **only if you skipped Upstash**. The app's daily/monthly caps then won't hold across instances: set a spend limit in the Anthropic Console and track spend there. Live-news briefings may also be regenerated more often (small extra cost). |
   | optional `USAGE_DAILY_COST_LIMIT_USD`, `USAGE_MONTHLY_COST_LIMIT_USD` | defaults: 1.50 / 20 |

4. **Deploy:** go to **Deployments → Redeploy** the latest one, or push to the production branch. Environment variables only apply to deployments made after you add them.

## Use it

1. Open your `https://<project>.vercel.app` address on your phone.
2. Go to **Settings → Access token**, enter `APP_ACCESS_TOKEN`, and save.
3. Install it to your home screen:
   - **iPhone:** Safari → Share → Add to Home Screen.
   - **Android:** Chrome → ⋮ → Install app.

## If something's wrong

| What you see | What to do |
|---|---|
| The orange "Demo mode" banner | `ANTHROPIC_API_KEY` is missing in this deployment. Add it, then redeploy. |
| "Storage isn't connected…" | Upstash isn't linked to the project. Link it, then redeploy. |
| "…until APP_ACCESS_TOKEN is set" | Add the variable, then redeploy. |
| "needs an access token" | Enter the token in the app's Settings. |
| AI requests time out | Requests are limited to about 50s. Try `CLAUDE_EFFORT_COACHING=low`. |

## Notes
- **Plan terms:** Vercel's Hobby plan is for personal, non-commercial use. A paid pilot needs Pro.
- **Audio uploads:** Vercel limits function request bodies to about 4.5 MB. A 3-minute recording is usually well under that.
- **Duplicate-request protection** is best-effort across instances. Spending limits are not, because they're shared through Redis.
