# Provider setup

All providers are optional. Without them, the app runs in labelled demo mode. Put keys in `.env`, which is git-ignored, and restart the server. The server log prints which mode is active. Keys are never sent to the browser.

## Claude (Anthropic API)

**Used for:**
- source-grounded briefings for live stories
- coaching feedback
- simulated audience questions
- adapting reviewed exercises

**Setup:**
1. Create an API key in the Anthropic Console and set `ANTHROPIC_API_KEY`.
2. Choose a model with `CLAUDE_MODEL`. The default is `claude-opus-5-5`. `claude-sonnet-5-5` or `claude-haiku-5-5` cost less, but switch only after the coaching eval shows quality holds. Check current model IDs and capabilities at https://platform.claude.com/docs/en/about-claude/models.
3. Set the pricing assumptions so cost estimates match your model. Prices are per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing:
   - `CLAUDE_PRICE_INPUT_PER_MTOK`
   - `CLAUDE_PRICE_OUTPUT_PER_MTOK`
   - `CLAUDE_PRICE_CACHE_READ_PER_MTOK`

   The defaults match published `claude-opus-5-5` list prices as of 2026-11 ($4 input, $20 output). Verify them before relying on the numbers.
4. Keep the limits low while testing:
   - `USAGE_DAILY_REQUEST_LIMIT=60`
   - `USAGE_DAILY_COST_LIMIT_USD=1.50`
   - `USAGE_MONTHLY_COST_LIMIT_USD=20`

   Every call is checked against a worst-case estimate before it is sent, then recorded using the token counts the API reports. See `GET /api/usage`.
5. Also set a spend limit in the Anthropic Console. The app's limits are a second line of defence, not a replacement.

**Request behaviour:**
- Structured JSON output (`output_config.format`), validated again on the server.
- Adaptive thinking, with effort configurable for each kind of call.
- A 60-second timeout and one SDK retry.
- The server-side refusal fallback (`fallbacks: "default"`) is on by default. Turn it off with `CLAUDE_REFUSAL_FALLBACK=off`.
- A malformed, truncated or refused response becomes an error the user can retry. The app never swaps in demo feedback when a live call fails.

## Live content: Wikipedia "In the news"

**What we use:**
- **Story list:** the Wikimedia Feed API, `https://api.wikimedia.org/feed/v1/wikipedia/en/featured/YYYY/MM/DD`, field `news[]`.
- **Article text:** the MediaWiki Action API with TextExtracts, `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|revisions&explaintext=1`.

**Setup:** no key is needed. Set `CONTENT_USER_AGENT` to a descriptive string with contact details, for example `ClearlinePilot/0.1 (you@example.com)`. Wikimedia's API etiquette asks for this.

**Licensing:** article text is CC BY-SA 4.0. Briefings derived from it are adaptations. They link to the article, say "Wikipedia contributors (CC BY-SA 4.0)", and would need the same licence if published.

**Behaviour:**
- Live stories appear only when Claude is also configured, because a briefing must be generated from the source text.
- Briefings are cached and shared per story revision.
- The list refreshes every `CONTENT_REFRESH_HOURS`. If a refresh fails, the last good list is shown and labelled as stale.
- Sources shorter than `CONTENT_MIN_SOURCE_CHARS` are skipped rather than padded out.

**Not yet verified:** the development container couldn't reach Wikimedia, so the adapter is built from documented response shapes and tested against fixtures. Run one live check before the pilot.

**Considered and deferred:** the Guardian Open Platform. Its free key appears to be non-commercial, and its terms for AI processing need a legal read first. See `docs/research/`.

## Transcription: Deepgram (pre-recorded)

**Setup:** create an API key in the Deepgram console and set `DEEPGRAM_API_KEY`. Optionally set `DEEPGRAM_MODEL` (default `nova-3`).

**Request:**
```
POST https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&mip_opt_out=true
Authorization: Token <key>
Content-Type: <the browser's recording type, e.g. audio/webm>
```
- `mip_opt_out=true` asks Deepgram not to keep the audio or transcript for model improvement.
- **Transcript:** `results.channels[0].alternatives[0].transcript`.
- **Word timings:** `...alternatives[0].words[]` (`start` and `end` in seconds). The app uses them to estimate approximate pace and count gaps longer than 2 seconds. It shows each figure with its limits, and never calculates timing from a transcript the user edited.

**Cost:** set `TRANSCRIPTION_PRICE_PER_MINUTE_USD` from your Deepgram plan. The default of $0.0077/min is a conservative assumption; the batch rate may be lower. The daily cap is `USAGE_DAILY_TRANSCRIPTION_MINUTES`.

**User consent:** the first time someone transcribes, the app explains that their audio goes to Deepgram and asks them to agree. Without transcription, users listen back and type what they said, and the transcript is marked "typed by you".

**Not yet verified:** the adapter follows Deepgram's public docs and is tested against fixtures. It hasn't been run against the live API.

## Costs beyond AI

| Item | MVP | Pilot estimate (assumption) |
|---|---|---|
| Hosting (single small Node instance) | Local | ~$5–25/month |
| Storage | Local files and the browser | Negligible: no audio is stored on the server |
| Content (Wikimedia) | Free, with attribution | Free. A licensed news API would need a quote |
| Transcription | Optional | ~$0.015 per 2-minute answer at the assumed rate |
| Payments | — | ~3% + $0.30 per charge (web), or 15–30% (app stores) |

## Deploying beyond localhost

1. Set `APP_ACCESS_TOKEN`. If you don't, the server refuses to start on a non-loopback host whenever paid providers are configured.
2. Users enter the token under Settings.
3. Before any public deployment, work through the production requirements in `docs/MASTER_PLAN.md` §5. They include real accounts, per-user quotas, a database and a privacy policy.
