# MVP report: 2026-11-02

## Completed

### Learn & Explain
The full journey runs end to end:
1. A daily selection based on interests.
2. A sourced briefing with an uncertainty box, one key term, and source excerpts that are checked against the source.
3. Recall from memory, with assisted attempts marked.
4. Coaching feedback, an optional retry, and a side-by-side comparison.
5. An optional follow-up question.
6. Save one item (idea, phrase or skill) for later review.

### Rehearse a Talk
- Four scenarios, with setup for audience, prior knowledge, desired outcome, topic and notes, target length (60, 120 or 180 seconds), and question style.
- Optional preparation, then a focused recording screen with a timer that can be hidden and no cut-off at the target time.
- A simulated audience question, plus an optional second one.
- Feedback, and a retry with comparison.
- A story from Learn & Explain can be turned into a talk.

### Shared components
- Speak or type an answer.
- Recording and playback, with explicit handling for: permission denied, unsupported browser, empty recording, cancellation.
- Transcription only with consent; users can correct the transcript, and edits are marked.
- Optional on-device audio saving, with deletion.

### Coaching with Claude (server-side)
- Responses use structured outputs and are re-validated with Zod.
- Quotes attributed to the user are checked against what they actually wrote.
- `max_tokens`, refusal and malformed outputs each surface as an explicit error.
- Timeouts and a bounded number of retries.
- Usage limits on requests, daily and monthly cost, and transcription minutes.
- A token and cost ledger, and duplicate-request protection.
- The model and effort level are configurable.

### Content
- One live provider: Wikipedia "In the news" (CC BY-SA).
- Briefings are cached per revision, and flagged when the source changes.
- Stale and unavailable states are shown honestly, and sources that are too short are refused.
- A curated evergreen library of 11 items, with sources.

### Transcription
- A Deepgram adapter with `mip_opt_out` and pace/pause metrics derived from word timings, each shown with its limitations.

### Review and progress
- A deterministic review ladder with a daily cap. Users recall before the answer is revealed, then self-assess. They can skip, dismiss or delete an item.
- The progress page separates spoken and written sessions, and shows skills, review results, history with saved recordings, and real-world missions with self-reported comfort.

### Demo mode
- Works without any credentials, and every surface labels it clearly.
- Illustrative feedback never claims to have evaluated the user's answer.
- A failed live request is never quietly replaced with demo output.

### Privacy and safety
- History is stored locally and can be deleted.
- Logs contain no user content.
- An optional access token is supported. The server refuses to listen on a non-loopback address when paid providers are configured without a token.

## Verified

### Automated
| Check | Result |
|---|---|
| `npm run typecheck` | Clean |
| `npm test` | **74 tests pass** |
| `npm run build` | Succeeds |

The 74 tests cover:
- Both journeys, using jsdom tests against the real in-process server.
- Retry and completion.
- Assisted versus unaided recall.
- Source metadata, insufficient sources and stale sources.
- Missing credentials and provider failures.
- Malformed, truncated and refused AI output.
- Quote verification.
- Duplicate and concurrent requests.
- Usage limits and access control.
- Persistence, review scheduling and deletion.
- Content-free logging.
- No secrets in the client bundle, checked by building with fake keys set.

### Browser (headless Chromium, real build, fake microphone)
- **Both journeys, mobile (390×844):** completed, including recording and playback, the typed transcript, retry and comparison, and the audience question. Data persisted after a refresh, and history deletion worked. No console errors.
- **Desktop (1280):** layout checked.
- **Accessibility:** axe-core WCAG 2 A/AA and best-practice checks on 8 screens, in both light and dark themes, found **0 violations**. Contrast is included.
- **Live feedback rendering:** checked with a *fake* Claude transport.

## Not verified

**No live API calls were made.**
- No Anthropic key was available, so there are **no measured token or cost figures yet**. The figures in `MASTER_PLAN.md` §6 are estimates.
- The container's network policy blocked Wikimedia and Deepgram. Both adapters follow their documented response shapes and are tested only against fixtures.
- The coaching eval set (`eval/`) has not been run live.

**Real-microphone and cross-browser behaviour is untested.** Safari/iOS and Firefox recording formats have not been checked. In Chromium, a webm recording reports a duration of `Infinity` until it has played once. This is a known browser quirk, and playback works.

## Next steps
1. Add an Anthropic key and set Console spend limits.
2. Run `npm run eval:coaching -- --live --yes` (about $0.30–0.90). Have two reviewers score the results against `eval/RUBRIC.md`.
3. Verify the Wikimedia and Deepgram adapters with one live request each. Set `CONTENT_USER_AGENT`.
4. Test on real iOS Safari and Android Chrome.
5. Add a "Was this useful?" rating to feedback. Then start the interviews in `docs/PILOT_PLAN.md`.
