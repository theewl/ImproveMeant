# Independent code review A — correctness, security, privacy (2026-11-02)

Scope: `src/client`, `src/server`, `src/shared`, `scripts/build-vercel.mjs`, `vercel.json` on branch `claude/confidence-cbt`. Read-only review; `npm run typecheck` and `npm test` (10 files, 106 tests) both passed at the start of the review. Line numbers refer to the working tree at the time of writing. **Note:** the tree was being edited concurrently while this review ran (commits `5313ffc`..`e1132bc` landed, plus uncommitted edits to `ResponseCapture.tsx`, `useRecorder.ts`, `styles.css`). Each claim below was re-checked against the file as it stood when the line number was taken.

Things that were checked and are **fine** (so nobody re-audits them): no `dangerouslySetInnerHTML` anywhere; all model/user strings go through React escaping; `CRISIS_RESOURCES` hrefs are a fixed `tel:988` and an `https://` URL; the auth exemption for `/api/status` cannot be bypassed with `..`, `%2e%2e`, `//`, `%73tatus` or trailing-slash tricks (probed against a live `@hono/node-server` listener: every variant other than the literal status path returns 401, because node-server normalises dot segments and Hono's router does not normalise, so the router never matches a protected route under a path the auth middleware exempted); `safeEqual` is constant-time; no CORS middleware (so a cross-origin page can't read API responses and non-simple POSTs are blocked by preflight; DNS-rebinding is additionally defeated by `isRemoteRequest` when paid providers are on); the client build test proves secrets don't reach the bundle; request/error logs carry no content; confidence data (experiments, ladder, reframes, impact checks, talk check-in, `selfView`) is never part of any API request body — `FeedbackBody.response` is `{text, modality, transcriptEdited, assisted}` only and `TalkSetup` carries no anxiety fields; `exportJson` strips `accessToken`; Anthropic SDK usage (`claude-opus-5-5`, `thinking: adaptive`, `output_config.effort/format`, `betas: server-side-fallback-2026-07-01` + `fallbacks: "default"`, refusal/max_tokens stop reasons handled) matches the current API.

---

## Findings, most severe first

### 1. [HIGH] Stale `pending`/`pendingAnswer` attempt is reused when the learner edits and resubmits after a feedback error — their edited text is silently discarded
- `src/client/screens/LearnSession.tsx:150` and `:168` — `const attempt = pending ?? (draft ? await s.makeAttempt(draft, …) : null)`.
- `src/client/screens/TalkSession.tsx:147` and `:167` — same pattern with `pendingAnswer`.
- Scenario A (Learn): feedback request fails (timeout, 429, 5xx). `pending` still holds the failed attempt. The transcript textarea in `SpokenAnswer`/`TypedAnswer` is still rendered and enabled under the `ErrorNotice`. The learner edits the text and presses "Get feedback" → `submitMain(draft)` → `pending ?? …` picks the **old** attempt; the edited draft is thrown away and the old text is sent again. The only path that clears `pending` is the small "Edit my answer" link (`:236`), which the user must know to click first. Same for the follow-up (`:168`).
- Scenario B (Talk): the first audience-question answer fails (`submitAnswer` sets `pendingAnswer` at `:149`, request throws). The learner clicks "Skip the question" → `skipQuestion()` (`:158`) succeeds, phase becomes `feedback`, but `pendingAnswer` is never cleared. They click "Take one more question", record a **new** answer, submit → `submitSecondAnswer(draft)` at `:167` uses the stale first answer. The new recording is discarded and the old text is sent for the second question. Also the stale `ans` has `audioBlob` already saved to IndexedDB if `keepAudio` was ticked (orphan).
- Fix: only reuse the pending attempt when called with `draft === null` (the explicit "Try again" path): `const attempt = draft ? await s.makeAttempt(draft, …) : pending;`. Clear `pendingAnswer` in `skipQuestion` and in `requestTalkFeedback`'s success path, and in the Learn "Try again"/phase-change paths.

### 2. [HIGH] Transcription cost limits are enforced on a client-supplied duration
- `src/server/app.ts:213-214` reads `seconds` from the query string, validates only `0 < seconds <= 600`, then `:221 usage.assertTranscriptionAllowed(seconds)` and `:224-231 usage.record({ audioSeconds: seconds, costUsd: seconds/60 * price })`.
- `src/client/lib/api.ts:63` sends `seconds.toFixed(1)` from the browser timer.
- Scenario: any client holding the access token (or any local client when no token is set) posts a 10-minute recording with `?seconds=1`. The daily-minutes cap and monthly-cost cap are evaluated against 1 s; the ledger records 1 s. MASTER_PLAN §5 promises "Usage limits, enforced on the server before each call". Deepgram's response carries `metadata.duration`; the 12 MB body limit (`:211`) is the only real bound today (≈ 60+ minutes of Opus audio).
- Fix: pre-check with a byte-based worst case (`buf.byteLength / minBytesPerSecond`) and record the actual `metadata.duration` returned by Deepgram (`src/server/transcription/deepgram.ts` currently drops it, `:63`). Also pass that real duration to `deliveryFromWordTimings` so WPM isn't computed against a spoofed length.

### 3. [MED] Review items are never due until the same clock time the next day, not "tomorrow"
- `src/shared/schedule.ts:67` `Math.max(card.due, now + DAY_MS)`; `:28` `firstDueDate = addDays(createdAt, 1)`; `:23` `isDue` compares instants.
- Scenario: learner reviews at 21:30 Monday. Item is due 21:30 Tuesday. Tuesday 08:00 (their habitual slot) the Today badge shows 0 due; the item effectively slips to Wednesday. The comment says "Never schedule for later the same day" but the implementation is "not within 24 h". The recent `localDayKey` fix (commit `5313ffc`) only changed the *cap* counting, not the due comparison, so the UTC/local mismatch is fixed but the 24-hour drift remains.
- Fix: make `isDue` day-based (`localDayKey(item.dueAt) <= localDayKey(nowIso)`) or clamp the minimum due to local midnight + 1 day. FSRS already returns day-granular dates; only the floor is wrong.

### 4. [MED] Prompt-injection surface: client-supplied strings are interpolated *outside* the protected data tags, and the tags themselves are not escaped
- `src/server/coach/prompts.ts:68` `Task given to the learner: ${p.taskPrompt}` — `taskPrompt` is built from `talk.topic` (300 chars, client-supplied) and `talk.audience` (200 chars) via `fillPrompt` (`src/server/app.ts:167`).
- `:92` `The learner was asked to focus on: ${p.previous.retryFocus}` (400 chars, client-supplied, `app.ts:62`).
- `:97` `Evaluate the learner's answer to this question: "${p.followUp.question}"` (400 chars, client-supplied, `app.ts:63`).
- `src/server/coach/prompts.ts:91,98,100` etc.: `<learner_response>${text}</learner_response>` — a response containing `</learner_response>` closes the tag early; text after it sits outside any "untrusted" tag. The same applies to `<source_text>` for Wikipedia extracts (a vandalised article).
- Impact today is bounded (structured output, verified quotes, length clamps, single-user) — the learner can mostly only poison their own feedback — but the `DATA_RULE` promise in the system prompt is weaker than it reads, and the Wikipedia path is third-party input.
- Fix: a `sanitizeTagged(text)` helper that rewrites `</?(source_text|learner_response|learner_notes|follow_up_answer|talk_setup)\b` to a harmless form before interpolation, and move `taskPrompt`/`retryFocus`/`followUp.question` inside tags (or derive `followUp.question` and `retryFocus` server-side from the stored briefing/session rather than trusting the client copy).

### 5. [MED] Talk recording is lost if the audience-question step is abandoned
- `src/client/screens/TalkSession.tsx:100-110` `submitTalk` (non-retry) stores the attempt only in `pending` React state and moves to `question`; it reaches `s.session.attempts` (and therefore localStorage) only when `requestTalkFeedback` later succeeds (`:136`). `useSession`'s persist effect (`src/client/lib/useSession.ts`) runs only when `attempts.length > 0`.
- Scenario: learner records a 3-minute talk, the audience question is loading or errored, they tap the Exit "X" or the browser reloads → the transcript, timings and `selfView` are gone; if "Keep this recording" was ticked the blob is already in IndexedDB under `audio-<id>` with no attempt referencing it (orphan until "Delete all history").
- Fix: `s.addAttempt(attempt)` immediately in `submitTalk` (feedback-less), then merge feedback into it later with `addAttempt({...attempt, feedback})` (it already de-dupes by id).

### 6. [MED] No React error boundary; a single bad stored record or a malformed link blanks the whole app
- `src/client/lib/router.ts:21,23` — `decodeURIComponent(parts[1])` throws `URIError` on `#/learn/%E0%A4%A`; it is called inside the `useState` initializer of `useRoute`, i.e. during render of `App`. There is no `ErrorBoundary` anywhere (`grep componentDidCatch|ErrorBoundary src` → none).
- `src/client/lib/storage.ts:52` only checks `version === 1`; no shape validation. `src/client/lib/state.ts:129` `skills[s.skill].sessions++` and `src/client/screens/Progress.tsx:194` `SKILLS[s.skill].short` / `getScenario(s.talk.scenarioId)` throw on an unknown id. A session saved by a future version with a renamed skill, or a hand-edited/corrupted localStorage entry, makes `Today`/`Progress` throw during render; `App` itself calls `dueQueue(data.reviews, …)`, so a non-array `reviews` breaks every route including Settings — the user has no in-app way to reach "Delete all history".
- Fix: wrap `decodeURIComponent` in try/catch (fall back to `today`); add a top-level error boundary with a "Reset local data" button; validate `loadData` with a light zod/manual check and drop unknown records rather than crash.

### 7. [MED] `Lookback` form state leaks across weeks (no `key`)
- `src/client/components/PlanCard.tsx:96` `{lookback != null && <Lookback week={lookback} />}`; `Lookback` (`:104`) keeps `open`, `well`, `inWay`, `next` in local state.
- Scenario: learner returns after three weeks away; `pendingLookback` returns week 1. They save it; `pendingLookback` now returns week 2 and React **reuses the same component instance** (same position, same type, no key), so the week-2 form appears already open and pre-filled with week-1 text; one more tap saves week-1 text as week-2's reflection.
- Fix: `<Lookback key={lookback} week={lookback} />` (and `key="w4"` on the fixed week-4 one).

### 8. [MED] Usage ledger write is a non-atomic read-modify-write
- `src/server/usage.ts:108-113` reads the whole monthly ledger, pushes, writes it back. With Redis on Vercel, two concurrent paid calls on different instances (e.g. Learn feedback + a `/api/stories` request that triggers a briefing generation, or two tabs) can lose a record, so daily/monthly caps undercount. Within one process the same race exists between the `await ledger()` and `store.write` of overlapping calls.
- Fix: for Redis, `INCRBYFLOAT`/`HINCRBY` per day/month counters plus `RPUSH` of records; for the file store, serialise writes through a promise queue.

### 9. [MED-LOW] Crisis-wording detection does not cover all confidence free-text fields
- Checked: `CrisisNotice` is used only in `Confidence.tsx` (PlanStep, CheckIn, ReframeFlow). Not covered: the Talk pre-check-in "What are you worried will happen?" (`src/client/screens/TalkSession.tsx:619`, saved as an `Experiment.prediction` — a confidence record), the look-back textareas (`PlanCard.tsx`), the real-world mission note (`Progress.tsx:286`), and ladder step titles. MASTER_PLAN §9 states: "If crisis wording is typed, the app shows 988…" without qualification.
- Also `src/shared/safety.ts:6` patterns are narrower than the comment ("deliberately broad") suggests: "don't want to be here", "not worth living", "overdose", "end things" are not matched.
- Fix: reuse `CrisisNotice` in those four places; extend patterns modestly (and add tests for them).

### 10. [MED-LOW] Observer-review ratings are attached to a *re-recorded* talk
- `src/client/components/ResponseCapture.tsx:255` `selfView = obs === "done" ? {predicted, observed} : undefined`; "Record again" (`:294`) calls `resetTranscript(); r.reset()` but does not reset `obs`.
- Scenario: learner predicts 4, listens, rates 7, then taps "Record again". The observer step is skipped for the new recording (obs is already `done`) and the old 4→7 pair is saved against a recording it was never about. `Progress` then reports "came across better than expected" from it.
- Fix: `setObs(p.focused ? "predict" : "off")` in the Record-again handler.

### 11. [MED-LOW] Recordings over 10 min (or over 4.5 MB on Vercel) cannot be transcribed, with a misleading error
- `src/server/app.ts:214` rejects `seconds > 600` with "Missing or invalid recording length." (400, non-retryable). The recorder deliberately has no cutoff ("You won't be cut off"); `pause/resume` was just added, making long takes more likely. Safari records `audio/mp4` (AAC) at a much higher bitrate than Opus, so a ~6–8-minute take exceeds Vercel's 4.5 MB body limit and the user sees a raw "Request failed (413)" (Vercel's 413 is not JSON).
- Fix: show the limit in the UI before recording ("transcription supports up to 10 minutes / ~4 MB"), give the 400 a clear message, and on the client fall back to "Type what I said" when the blob is over the limit.

### 12. [LOW] `isRemoteRequest` is weaker than its comment and the README imply
- `src/server/app.ts:253-258` treats a request as local iff `Host` is a loopback name **and** no forwarding header is present. `ssh -L`/`socat` port forwards and any proxy configured to pass `Host: localhost` without `X-Forwarded-*` are classified local. The comment says it "catches tunnels and port-forwarding" — it catches cloudflared/ngrok (they add headers), not plain TCP forwards. This is defence-in-depth only; the real control is `APP_ACCESS_TOKEN`, and `index.ts:13` refuses to bind non-loopback without it.
- Fix: compare the socket's remote address (`c.env.incoming.socket.remoteAddress` on node-server) instead of/in addition to `Host`; and soften the comment.

### 13. [LOW] `restorePath` oddities (no exploit found)
- `src/server/vercel.ts:53-60`: `__path=stories%3Fx=1&y=2` → `/api/stories?x=1?y=2` (double `?`); `__path=a&__path=b` keeps the first and silently drops `b` — which one Vercel puts first after merging the rewrite query with the original query is not documented, so `/api/stories?__path=usage` may route to either; `__path=../../etc` → `/api/../../etc` (node-server normalises it; nothing outside `/api` is served by the function, so harmless); CR/LF in `__path` is passed straight into `req.url` (node-server re-encodes via `new URL`). None of these bypass auth because the auth middleware runs on the final normalised pathname.
- Fix: reject any `__path` that contains `?`, `#`, control characters or `..` segments with a 400 before handing it to Hono; take the *last* `__path` or 400 on duplicates.

### 14. [LOW] No security headers / CSP on either deployment
- `scripts/build-vercel.mjs:38-43` sets only `cache-control` for `/assets/*`; `src/server/index.ts` adds none. No `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (microphone), or `frame-ancestors`. The app inlines no scripts and loads nothing third-party, so a strict CSP (`default-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'`) would be cheap. MASTER_PLAN lists this as not-yet-implemented, so this is a reminder with a concrete value, not a new bug.

### 15. [LOW] External `href`s are rendered unchecked
- `src/client/components/common.tsx:20` `href={source.url}` and `src/client/screens/Review.tsx:97` `href={item.source?.url}`. The value comes from the Wikimedia feed (`content_urls.desktop.page`) or the evergreen library, and is persisted in localStorage review items. React 19 still renders `javascript:` URLs (it warns in dev only). Risk is low (requires a hostile upstream or tampered localStorage) but a one-line guard is cheap.
- Fix: render the link only when `/^https?:\/\//i.test(url)`.

### 16. [LOW] Phrase-bank items added from the Phrases screen lose provenance and bypass the story-based de-dupe
- `src/client/screens/Phrases.tsx:36-45` builds a `phrase` review item without `storyId`, `storyKind`, `sourceVersion`, `source`, even though `BankEntry` has `storyId`. Consequences: `addReviewItem`'s duplicate check (`src/client/lib/state.ts:67-69`) keys on `storyId`, so it can't detect a duplicate of the phrase saved at the end of the Learn session (the UI-side `inReviews` string match on the prompt, `Phrases.tsx:30`, is the only guard); the Review card never shows the "From the news" tag nor runs the source-changed check for it. `phraseBank` also includes unfinished sessions, contradicting the empty-state copy ("Finish a Learn session…").
- Fix: pass `storyId/storyKind/source/sourceVersion` from the session (store `sourceVersion` on `PracticeSession` or reuse `buildReviewItem("phrase", …)`), and dedupe on `(kind, term)` as well as `storyId`.

### 17. [LOW] IndexedDB wrapper resolves on request success rather than transaction completion
- `src/client/lib/audioStore.ts:22-24`: `resolve` fires on `r.onsuccess`; `t.oncomplete` only closes the DB; `t.onerror`/`t.onabort` are unhandled. If the transaction aborts after the request succeeds (e.g. `QuotaExceededError` on commit, which is exactly the case for large audio blobs), `save()` has already resolved and `savedAudioKey` is persisted pointing at nothing; the DB handle also leaks on error.
- Fix: resolve in `t.oncomplete`, reject in `t.onerror`/`t.onabort`, and `db.close()` in all three.

### 18. [LOW] Misc robustness / best practice
- `src/client/components/ResponseCapture.tsx:134` detects cancellation by `err.message === "Cancelled."`; use `err.code === "network" && signal.aborted` or a dedicated code.
- `src/client/components/ResponseCapture.tsx:384` constructs a `new File(...)` and calls `navigator.canShare` on every render of `ShareClip`; memoise on `blob`.
- `src/client/lib/useRecorder.ts`: no `mr.onerror` handler; a device disconnect mid-take surfaces only as the generic "empty or too short" path. Also `blob.size < 1000` (`:113`) rejects legitimately short but valid 1–2 s Opus clips on some devices; the server check is the same.
- `src/client/screens/Confidence.tsx:115` inline IIFE inside JSX; lift to a `const`. `SubScreen` (`:266`) changes view without moving focus; `StepHeader`'s focus pattern from `common.tsx` should be reused so screen-reader users aren't left on a removed button when `go()` swaps views.
- Fixed element ids (`obs-pred`, `obs-seen`, `pre-anx`, `pre-pred`, `after-anx`, `if-obstacle`, `if-action`) are fine today because only one instance is mounted, but `useId()` would be safer; `ObserverSlider` already takes an `id` prop, so pass `useId()` values.
- `src/client/lib/store.tsx`: no `storage` event listener — two open tabs overwrite each other (last write wins). Acceptable for the MVP, worth a note in Settings.
- `src/server/config.ts:127` `.env` parser: trailing whitespace is kept inside the value before quote-stripping (`KEY="abc" ` → `"abc"` keeps its leading quote stripped but the trailing quote not). Trim first.
- `src/server/content/service.ts:66-67`: a failed feed refresh isn't backed off; every `/api/stories` call re-hits Wikimedia (12 s timeout each) while it's down. Record a short negative-cache timestamp.
- `/api/status` (unauthenticated by design) exposes `model`, limits and today's spend; fine for a personal deploy, consider gating `usageToday` behind the token for a pilot.
- `UsageMeter.claudeCost` prices every call at the configured model's rate even when `msg.model` reports a server-side fallback model; the ledger stores the served model, so cost can be re-priced if fallback pricing differs.

---

## Verified-OK notes (for the record)
- Dedupe keys include a hash of the full request body, so an idempotency-key reuse with different content cannot return another attempt's feedback (`app.ts:168`). The transcription key (`:222`) is key-only, which is acceptable because the key is minted per recording on the client.
- `Deduper` is per-instance; on Vercel without Redis, double-submits across instances can double-charge — documented in `docs/DEPLOY_VERCEL.md`.
- Hono `bodyLimit` checks `Content-Length` when present and otherwise streams, so the 64 KB / 8 KB / 12 MB caps hold for chunked bodies too.
- `plan.ts` week windows are instant-based from `startedAt` (a plan started at 23:00 rolls over at 23:00 a week later). Harmless, but if week boundaries are ever shown as dates they should be snapped to local midnight.
