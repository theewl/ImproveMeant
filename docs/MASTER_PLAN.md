# Master Plan: Clearline (working name)

> **Stay informed. Remember what matters. Have something to say.**

**Status:** living document. First written 2026-11-02, alongside the private MVP on branch `claude/mvp-learn-explain`.

**Name:** "Clearline" is a neutral placeholder and has not been checked for trademarks. We dropped "Spark" because an existing learning app already uses it. Branding is deliberately deferred.

Every section labels its statements with one of these tags:

| Tag | Meaning |
|-----|---------|
| **[E]** | Evidence: a source exists, linked and dated. |
| **[A]** | Assumption: plausible, but untested by us. |
| **[D]** | Decision: what we're doing now. It can be reversed. |
| **[Q]** | Open question. |

---

## 1. Product thesis

### Audience and problem
- **[A] Initial audience:** early-career professionals who are already fluent in English. They think: *"I know what I mean, but I ramble, lose my thread, or struggle to explain it."* They feel this most in meetings, status updates and short presentations.
- **[A] Problem:** They get few low-stakes chances to practise explaining something, and almost no specific feedback on whether the point landed. Generic advice ("be concise") is hard to act on.
- **[Q]** Is this a painful, frequent problem, or a mild annoyance? The interviews in §6 exist to answer this before we invest heavily.

### Primary outcome
**Explain a useful idea clearly, then handle a follow-up question.** [D]

News, vocabulary, recall and rehearsal are each included only because they serve this outcome:
- **Interesting material** gives you something worth explaining.
- **Recall from memory** forces you to construct the explanation yourself.
- **Coaching on one skill** makes improvement concrete.
- **A retry** lets you feel the difference straight away.
- **Spaced application** tests the skill again, in a new context.

### Why someone might return and pay [A]
- **Sessions are short** (3–5 minutes) and have a clear ending. People can use them in place of a scroll break.
- **Material changes daily,** so there is always something new to talk about. We keep it relevant through explicit interests rather than an engagement-optimised feed.
- **Progress is visible and concrete.** Examples: "Your request now appears in your opening sentence", attempt comparisons, and a log of real-world attempts. We avoid scores and streak pressure.
- **The upgrade path to human listeners (later)** creates value an AI-only product can't: confirmation that a real person understood you.

### How it fits together
```
Choose (story or talk)
  → Understand (short sourced briefing + one useful phrase)
  → Attempt from memory (speak or type)
  → One specific coaching point
  → Optional retry and comparison
  → Optional follow-up question
  → Save one item
  → Later review in a new context
  → Optional real-world mission
  → (future) human listener
```

The two modes share one loop:
- **Learn & Explain** starts from content.
- **Rehearse a Talk** starts from the learner's own situation.

A story can become a talk.

---

## 2. Competitive position

### Sources and caveats
Facts below are summarised from `docs/research/2026-11-competitive-and-provider-notes.md`, accessed 2026-11-01. That research ran in a network-restricted session. **Every claim is search-indexed rather than fetched directly**, and must be re-checked before it appears in pricing decisions or public copy. [E, weak]

### Closest alternatives

| Product | What overlaps with us | Price (as indexed 2026-11-01) | Main difference from our concept |
|---|---|---|---|
| **Yoodli** ([pricing](https://yoodli.ai/pricing)) | AI speech feedback, roleplay against simulated audiences, Q&A practice | Free: 5 lifetime sessions. Pro: $8/mo. Advanced: $20/mo (both billed annually). Teams: custom | Metric-heavy reports and roleplay. No content-to-recall loop, and no spaced re-application of a skill. |
| **Orai** ([pricing](https://orai.com/pricing/)) | Recorded practice with instant feedback, guided lessons | $12/mo, $49.99/yr, $149 lifetime | Delivery metrics (fillers, pace, energy) rather than message structure. |
| **Spoken AI** ([App Store](https://apps.apple.com/app/id6496860947)) | News content combined with AI spoken conversation | $19.90/mo (US in-app purchase) | Aimed at ESL learners. No retell-and-coach structure. |
| **Lexer** ([site](https://lexervocabulary.com/)) | News vocabulary with spaced repetition (FSRS) | Not verified | Vocabulary only. No speaking or communication skill. |
| **Deepstash** ([site](https://deepstash.com/)) | Short daily ideas positioned as a replacement for scrolling | Pro price shown in-app (not verified) | Passive reading. No recall, speaking or feedback. |
| **Toastmasters** ([dues](https://www.toastmasters.org/footer/faq/dues-increase)) | Structured speaking practice, human peer evaluation | $72 per 6 months + $25 joining fee (from 2026-08-03) | Real humans, but a fixed meeting schedule and untrained evaluators. |

**Substitutes:**
- General AI voice chat (ChatGPT or Claude): free or cheap, but you have to supply the structure yourself.
- Recording yourself on your phone.
- Speeko: about $24.99/mo or $99.99/yr (third-party snapshot).
- Poised: price not verified.
- Human coaches.
- Doing nothing, which is the most common substitute. [A]

### Differentiation hypotheses [A]
1. **Recall-then-explain on interesting material is a better practice unit than free-form speaking.** It produces material to talk about, plus retrieval practice.
2. **Coaching one skill at a time, with an immediate retry, beats broad metric dashboards** for people who ramble.
3. **Spaced application of the skill itself** (not only vocabulary) helps it transfer to real situations.
4. **Honest scope builds trust with this audience.** That means no fake confidence scores and no claims based on voice analysis.
5. **A human-listener check of whether the message landed (later) is a defensible addition.** Toastmasters does this only synchronously.

### What remains unvalidated [Q]
- Whether hypotheses 1–3 produce better real-world clarity than plain record-and-playback. See the study design in §7.
- Whether the audience will pay for this, alongside free general-purpose AI chat.
- Whether "news" is a draw, or a distraction from the speaking goal.
- Access to Claude is **not** a differentiator. Any competitor can call the same models.

---

## 3. User journeys and learning design

### Learn & Explain (built)
Target length is 3–5 minutes.

1. **Choose a story.** The learner sees 3–5 cards chosen from their explicit interests. Each card shows:
   - title and short description
   - publisher and publication date
   - a link to the original source
   - a current or evergreen label
   - estimated length
   - why it was selected
2. **Understand.**
   - A briefing of 2–4 points.
   - An "uncertain or disputed" box, shown when it's relevant.
   - One useful word or phrase, shown in context with an everyday example.
   - Supporting source excerpts, which the server checks automatically against the source text.
3. **Recall.**
   - The briefing is hidden. The learner explains the main idea, by recording or typing.
   - Reopening the briefing is allowed, but it marks the attempt as **assisted**.
4. **Improve.** One grounded strength, at most one priority improvement, and a short reason. "You met this goal" is allowed. An optional retry follows, with a side-by-side comparison.
5. **Apply or finish.** The learner can answer the briefing's follow-up question, or finish. The question is never forced.
6. **Return later.** Save one idea, phrase or skill for spaced review in a different form:
   - recall the idea
   - use the phrase in a new sentence
   - apply the skill to a new situation

### Rehearse a Talk (built)
- **Four scenarios:**
  - introduce yourself
  - explain an idea to a group
  - propose a change in a meeting
  - give a short persuasive talk
- **Setup:** audience, what they already know, desired outcome, topic and notes, target length (60, 120 or 180 seconds), and whether audience questions are supportive or challenging.
- **Flow:**
  1. Optional 60-second preparation.
  2. A focused presentation screen with an optional timer. The learner is never cut off.
  3. One question from the simulated audience.
  4. Feedback.
  5. An optional second question, and an optional retry with comparison.
- The audience is always labelled **simulated**.

### Later review and real-world application (built: basic)
- **Scheduling:** deterministic Leitner ladder (1, 3, 7, 16 and 35 days), at most 5 reviews a day, and at most 60 active items.
- **Recall before reveal:** the learner recalls first, then sees the saved answer and self-assesses. Self-assessment accepts a paraphrase as a correct answer.
- **Item controls:** skip, dismiss or delete.
- **News items:** reviewed "as reported on {date}" and flagged if the source has been edited since.
- **Missions:** optional real-world tasks with self-reported comfort, kept separate from observed performance:
  - explain today's idea to a friend
  - ask a question in a meeting
  - deliver an opening without notes

### Future human practice (planned, not built)
1. Private AI rehearsal. *(This is where we are now.)*
2. **Asynchronous invited partner:**
   - The learner shares a recording or text with someone they choose.
   - The listener answers three prompts:
     - What was the main point?
     - One clear moment.
     - One unclear moment.
3. **Scheduled invite-only pairs or small groups** using a fixed protocol:
   1. The speaker gives a 90-second explanation.
   2. The listener restates the main point.
   3. The listener asks one question.
   4. The listener names one clear moment and one unclear moment.
   5. The pair switch roles.
4. **Optional adult stranger matching.** Pairs are matched on goal, language, availability and comfort level.

**Key metric:** did the listener's restated main point match what the speaker intended?

**Before any stranger access, we need:**
- conduct rules
- leave, mute, block and report controls
- moderation procedures
- explicit consent for recording and transcription, with recording off by default
- AI feedback and human feedback labelled separately

### Quiet (typed) practice vs. spoken practice [D]
- **Typing is a full alternative.** It suits a commute, an open-plan office, or a learner who prefers it.
- **The two are tracked separately.** Typed and spoken sessions are counted apart, and every attempt carries its modality.
- **Typed practice exercises structure, not delivery.** We never present typed success as speaking skill.
- **Spoken attempts add only measured observations.** These are recording length and, with a transcription provider, approximate pace and long gaps taken from word timestamps. Each one comes with an explanation of its limits.
- **Edited transcripts are marked.** Pace numbers always come from the original recording, never the edited text.

---

## 4. Release roadmap

No dates are given; each phase moves forward only on evidence.

| Phase | Purpose | Depends on | Success signals | Reasons to pause or change direction |
|---|---|---|---|---|
| **0. Private MVP** (this release) | One person can complete both journeys, live or in demo mode. | — | Both journeys work end to end. Coaching passes the rubric on the eval set. Cost per session is measured. | Coaching is often generic or wrong (rubric scores below 1.5/2), or cost per session is more than about $0.25. |
| **1. Small pilot + iteration** (about 15 interviewees, 5–10 users) | Find usability problems and test whether the feedback is useful. | Hosted build behind an access token. Server-side per-user limits. Interview findings. | Unprompted return visits in week 2. "Feedback was specific and useful" from a majority of sessions. At least 3 real-world missions logged. | People don't come back without reminders. Feedback is perceived as generic. The audience shows no felt pain. |
| **2. Paid beta** (4-week guided pilot) | Test willingness to pay, and renewal. | Accounts and sync, payments, privacy policy, and production requirements (§5). | A target of 10 paying participants, treated as an experiment milestone, not proof of fit. At least 40% would renew. Completion of 3 or more sessions a week. | Low conversion after a clear offer. Refunds. Unit economics negative at realistic usage. |
| **3. Invited-partner practice** | Test whether human listener checks add value. | Sharing with consent, a listener form, labels that separate AI and human feedback, and deletion. | Listeners complete their reviews. The intended main point matches the listener's restatement more often over time. | Partners don't respond. Social friction outweighs the value. |
| **4. Scheduled groups → optional stranger matching** | Scale human practice. | Moderation, reporting, conduct policy, scheduling, real-time media (vendor), and age verification. | Sessions held as scheduled. Low report rate. Retention above the AI-only cohort. | Safety incidents, no-shows, or moderation cost per session too high. |

---

## 5. Technical design

### Application structure [D]
- **Stack:** one TypeScript repo. React 19 and Vite for the mobile-first client. A Hono server running on Node (`src/server`). Pure domain logic in `src/shared`, which has no Node or DOM dependencies.
- **Shared interfaces:** live and demo modes use the same provider interfaces:
  - `CoachProvider`, implemented by `ClaudeCoach` and `DemoCoach`
  - `ContentProvider` (`WikimediaProvider`)
  - `TranscriptionProvider` (`DeepgramProvider`)

  `createServices()` wires these from configuration.
- **Ordinary code handles everything that isn't AI work:** timing, scheduling, word counts, delivery metrics, quote verification, persistence and cost estimates.

### Data model (`src/shared/types.ts`)
| Record | Fields |
|---|---|
| `Preferences` | Up to 3 interests, goal, session length. |
| `StoryCard` | Every card carries a `SourceMeta`: url, publisher, publishedAt, retrievedAt, sourceUpdatedAt, byline. |
| `Briefing` | Points, mainIdea, uncertainty, keyTerm, followUpQuestion, supportingExcerpts, coverage, generatedBy, sourceVersion. |
| `Exercise` | skill, difficulty, prompt, successDefinition, exampleFeedback, laterVariation. Reviewed in code (`src/shared/curriculum.ts`): 13 exercises across 4 skills. |
| `Scenario` | Four scenarios, each with reviewed sample question banks. |
| `PracticeSession` | Contains `Attempt[]`. Each attempt records modality, transcriptEdited, originalTranscript, transcriptSource, assisted, isRetry, delivery, savedAudioKey and feedback. |
| `Feedback` | `kind: "live" \| "illustrative"`, goalMet, strength, priority (each with a quote that has been verified), fidelity, opinionNote, followUpNote, retryFocus. |
| `ReviewItem` | Kind (idea, phrase or skill), step, dueAt, history, status, and sourceVersion / sourceChanged. |
| `RealWorldAttempt` | Mission, note, and an optional self-reported comfort score (1–5). |

### Content sourcing
**[D] Live provider: Wikipedia "In the news".** We use the Wikimedia featured-content feed for selection, and the MediaWiki TextExtracts API for article text.

Why this source:
- No key is needed.
- A published reuse licence (CC BY-SA 4.0) allows processing and adaptation, with attribution and share-alike.
- Revision IDs let us detect corrections.

**[Q] Briefings derived from Wikipedia are adaptations.** If we publish them, they must carry the same licence and attribution.

**[D] The Guardian Open Platform was considered and deferred.** Secondary sources describe its free key as non-commercial, and we couldn't verify its terms on caching or AI processing (see the research notes). It needs a legal read before any use.

**Rules implemented:**
- We process only the article's own plain text, bounded to 14k characters. Partial coverage is labelled.
- Sources shorter than 1,800 characters are refused rather than padded out. The model can also declare a source insufficient.
- Briefings must include excerpts that match the source text exactly. Excerpts that don't match are dropped. If none match, the whole briefing is rejected.
- Briefings are cached and shared per story, and keyed to the revision they were generated from. When the source revision changes, cached briefings and saved review items are flagged.
- The story list refreshes on a fixed interval of 6 hours. If a refresh fails, we serve the last cache labelled as **stale**. If there is no cache, we say live news is **unavailable** and never fabricate it.
- Live stories are offered only when Claude is configured, so a curated briefing is never presented as live news.
- **[D] Editorial choice:** "In the news" items about deaths and attacks are skipped for this practice product.
- **The curated evergreen library** has 11 items. Each is original text, links to a public reference, and states its uncertainty where it applies.

### Claude integration
- **Server-side only.** The model is configurable (`CLAUDE_MODEL`, default `claude-opus-5-5`). Effort is configurable per call type: medium for coaching and briefings, low for questions and variations.
- **Call settings:** adaptive thinking, a refusal fallback (configurable), a 60-second timeout, and at most 1 SDK retry.
- **Outputs are structured** (JSON schema from Zod) and re-validated on the server. Lengths are clamped, and `max_tokens`, refusal and malformed responses are each handled explicitly.
- **Prompts are fixed, reviewed text** (`src/server/coach/prompts.ts`). Source and learner text go inside labelled tags, with a rule to treat them as data, never instructions.
- **Feedback context is compact.** The model gets the exercise, the success definition, an example of feedback, the briefing (not the full article), the response, and the previous attempt when the learner is retrying.
- **The AI adapts reviewed exercises; it doesn't invent the teaching approach.** The adaptation endpoint takes the reviewed `laterVariation` as its input.

### Recording and transcription
- **Recording:** the browser's `MediaRecorder` (webm/opus, mp4 or ogg, whichever is supported). The code handles:
  - microphone permission denied, or no microphone
  - an unsupported browser or format
  - empty or very short recordings
  - cancellation
  - a timer the learner can hide, with no cutoff at the target time
- **Transcription:** an optional Deepgram pre-recorded adapter (`model=nova-3`, `smart_format`, `mip_opt_out=true`). It runs only after the learner gives explicit consent in the app.
- **Correcting the transcript:** the learner reviews and edits it before coaching, and edits are marked. When no transcription provider is configured, the learner listens back and types what they said, which is marked "typed by you".
- **[Q] Verify Deepgram against its official docs** before the first live use. Our adapter follows documented shapes, but the dev container couldn't reach the API.

### Review scheduling
A deterministic ladder in `src/shared/schedule.ts`. Results move items as follows:

| Result | Effect |
|---|---|
| Recalled | Up one step |
| Partly | Stays on the same step |
| Missed | Back to the first step |
| Skipped | Postponed 1 day |

A daily cap prevents a backlog. **[Q]** Consider FSRS once there is enough review data.

### Persistence
- **[D] Private single-user MVP: browser `localStorage`** holds preferences, sessions, transcripts, feedback and reviews. Recordings go to **IndexedDB**, and only if the learner opts in.
- **Server:** stores files under `DATA_DIR`. It keeps the usage ledger (no content) and the shared briefing and story caches (no personal data).
- **Limitations:** data stays in one browser profile, with no sync or backup. It's lost if site data is cleared, and its size is limited by the browser.

### Privacy, access control and cost limits
- **No secrets reach the client.** API keys live only in the server environment. A test builds the client with fake keys set and checks that none of them appear in the bundle.
- **Logs contain no content.** Request logs record only the method, path, status and duration.
- **Access token:** `APP_ACCESS_TOKEN` protects all API routes except status. The server refuses to start on a non-loopback host if paid providers are configured and no token is set.
- **Usage limits, enforced on the server before each call:** daily request count, daily and monthly cost in USD (from a worst-case estimate), and daily transcription minutes.
- **Usage records:** the provider's reported token counts, plus an estimated cost from **configurable price assumptions**.
- **No duplicate charges.** An idempotency key on each attempt means concurrent duplicates share one call, and repeats get the cached result. Failures are not cached.
- **Deleting history** clears localStorage and IndexedDB. It can't recall data that Anthropic or Deepgram have already processed. The settings page says so.

### Production requirements not yet implemented [Q]
- **Real accounts and authentication,** with per-user server-side quotas. The single shared token in the MVP isn't enough.
- **A server-side database** with encryption at rest, backups, and server-side deletion and export.
- **Rate limiting** per IP and per user, and abuse monitoring.
- **Legal documents:** privacy policy, terms, a data processing record, and sub-processor disclosure (Anthropic, Deepgram, host).
- **HTTPS, CSP headers,** and a dependency audit in CI.
- **Wikimedia rules:** a descriptive User-Agent with contact information, and confirmation of API etiquette and rate limits.
- **Observability** without any content in logs.
- **Cost alerts** at the Anthropic Console or billing level.

---

## 6. Business experiments

### Audience interviews (before any build beyond the MVP)
**Sample:** about 15 people in their first five years of work. Recruit through the team's network, alumni groups and professional communities. Exclude friends who will just be kind.

Ask about the **last specific time** each of these happened:
- they rambled
- they lost their thread
- they couldn't explain something

Then ask:
- What happened next?
- What have they tried? Toastmasters, YouTube, AI chat, nothing?
- What did those attempts cost them, and why did they stop?

**Then a live test.** Run one session on a situation they care about, using their real upcoming meeting as the talk. Observe silently, then debrief.

**Record:** how painful and how frequent the problem is, the words they use for it, and what they currently spend on it in money and time.

### Pricing and offer tests [A — hypotheses only]
- **Subscription:** $12/month (anchored near Orai's published $12/mo), compared with an annual plan of about $79.
- **Guided programme:** $39 for a 4-week guided pilot. It includes a weekly plan, a check-in, and a before/after recording reviewed by a human.
- **Testing method:** a landing page or direct offer during the interviews. Measure real pre-payment, not stated intent.

### Acquisition channels to test (none run yet; outreach needs explicit approval)
1. LinkedIn posts or newsletter content about "explaining work clearly", using real before/after examples, with consent.
2. University career centres and alumni networks (new graduates).
3. Early-career communities, such as internal employee resource groups and bootcamp alumni Slack groups.
4. A free "60-second opening" mini-tool that leads to the guided pilot.

We will not send outreach, publish ads or buy services without authorisation.

### Retention and willingness to pay
- **[Q]** Do people return without notifications? What triggers a return: a meeting coming up, or curiosity about the material?
- **[Q]** Is the human-listener feature (phase 3) the thing people would pay for?
- **[Q]** Do people prefer a time-boxed programme ($39) or an open subscription?

### Unit economics
These are estimates. **Measured usage: none yet.** No live calls were made during development because no credentials were available.

**Assumptions:**
- Claude Opus 5.5 at $4 per million input tokens and $20 per million output tokens (verify on the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing)).
- Deepgram at about $0.0077/min, possibly lower for batch (unverified).

| Item | Tokens or units (assumed) | Est. cost |
|---|---|---|
| Feedback call (thinking + JSON) | ~1.8k in / ~1.5k out | ~$0.037 |
| Audience question (low effort) | ~0.8k in / ~0.4k out | ~$0.011 |
| Live briefing (shared per story per day) | ~4k in / ~2k out | ~$0.056 ÷ readers |
| Transcription | 2 min audio | ~$0.015 |
| **Learn session** (attempt + retry, spoken) | 2 feedback calls + 2 transcriptions | **~$0.10–0.12** |
| **Talk session** (question, feedback, retry) | 3 calls + 2–3 transcriptions | **~$0.11–0.14** |

**What this means per user and for the pilot:**
- A user doing 15 sessions a month costs about $1.50–2.10 in AI and voice.
- At $12/month, that leaves roughly 80% gross margin before hosting and payment fees:
  - Card fees run about 3% + $0.30.
  - App store fees would be 15–30% for a native app.
  - Hosting is about $5–25 a month for a small instance (assumption).
- A heavy user doing 60 sessions a month (about $7) would erode the margin. The daily caps exist for this reason.
- The $200 credit covers about 1,500 sessions at these estimates. A pilot of 10 users × 4 weeks × 4 sessions a week is about 160 sessions, or about $20. The pilot should still **record the full cost** as if it were unsubsidised.

**Levers:**
- A cheaper model (`claude-sonnet-5-5` at $2/$10, or `claude-haiku-5-5`). Only switch after the eval set shows quality holds.
- Lower effort.
- Prompt caching. The current prompts are probably below the minimum length that can be cached.
- Typed practice, which needs no transcription.

**Other costs:**
- Hosting.
- Storage, which is negligible while we don't store audio.
- Licensed news APIs, if we ever need one. Pricing is unknown and needs a quote.
- Payment fees.
- Moderation, for phase 4.

---

## 7. Validation plan

| Area | Method | Signal | Can a small pilot establish it? |
|---|---|---|---|
| **Usability** | 5–8 moderated sessions on mobile, think-aloud | Time to first useful exercise under 90 seconds. No blocking errors. Users can find the typed alternative and transcript editing. | **Yes.** It reliably finds usability problems. |
| **Coaching quality** | `eval/coaching-cases.json` plus `eval/RUBRIC.md`, scored by two blind human reviewers. Pilot users rate each piece of feedback as useful, partly useful or not useful. | Mean rubric score of at least 1.5/2 on every criterion. No fidelity or injection failures. At least 60% of feedback rated "useful". | **Partly.** It catches obvious failures, but not subtle bias. |
| **Learning and transfer** | Compare our loop with ordinary record-and-playback, using matched practice time. Use comparable *unfamiliar* prompts before and after, and a delayed follow-up after 2–4 weeks. Blind human reviewers rate clarity, and listeners restate the main point, without knowing the order or group. Track self-reported confidence **separately**. Report every dropout. | Listener restatement accuracy and clarity ratings improve more than in the control group. | **No.** A small pilot is underpowered and isn't proof. It can only show direction and effect-size ranges to plan a proper study. |
| **Engagement** | Unprompted weekly sessions, completion rate, review completion, missions logged | Users return in week 2 without nudges. Sessions are completed rather than abandoned. | **Early signal only.** Engagement isn't learning. |
| **Payment and renewal** | Paid 4-week pilot with a clear description of what exists today | Paid sign-ups, use during the pilot, renewal intent, and actual renewal | **Early signal only.** 10 payers is a milestone, not product–market fit. |

**What we will not claim:**
- improved intelligence or general memory
- treatment of anxiety or speech disorders
- confidence inferred from someone's voice
- engagement or revenue as evidence of learning

---

## 8. Prioritised backlog

### Now (implemented in this MVP)
- [x] Learn & Explain journey, with sourced curated and live briefings, assisted and unaided recall, feedback, retry and comparison, an optional follow-up, and save-for-later.
- [x] Rehearse a Talk: four scenarios, setup, preparation, focused recording, a simulated audience question (plus an optional second), feedback, and retry with comparison.
- [x] Recording and playback, and optional on-device audio saving with deletion.
- [x] Transcription adapter (Deepgram) with consent and transcript correction. Typed alternative throughout.
- [x] Claude coaching with structured outputs, validation, quote verification, timeouts, limits, deduplication and cost records.
- [x] Live content (Wikipedia "In the news") with caching, stale and unavailable states, an insufficient-source check, and correction flags, plus a curated evergreen library.
- [x] Review scheduling with a daily cap, skip, dismiss and delete. Progress page, missions and history deletion.
- [x] Demo mode across all of the above, with illustrative feedback clearly labelled.
- [x] Coaching eval set and rubric. 74 automated tests.

### Next (before or during the pilot)
1. **Run the eval set live** (about $0.30–0.90), score it with two reviewers, and tune the prompts.
2. **Verify Deepgram and Wikimedia** against their live APIs. Set a real `CONTENT_USER_AGENT`.
3. **Accounts and per-user quotas;** move from localStorage to a server database, with export and deletion.
4. **Feedback rating** ("Was this useful?") on each piece of feedback, for pilot measurement.
5. **Deploy the hosted pilot** behind access control, with an error-tracking tool that never logs content.
6. **Interview guide and pilot onboarding copy.** Before/after "unfamiliar prompt" recordings for the pilot cohort.

### Later
- An asynchronous partner listener (phase 3).
- FSRS scheduling.
- An "adapt to my situation" step during sessions.
- A second content provider under a commercial licence.
- PWA install and offline review.
- A gentle optional reminder (a single daily nudge, off by default).
- A Spanish or other-language audience, only if the interviews point to it.

### Explicitly deferred
- **Ruled out for the MVP and early phases:**
  - public rankings
  - streak pressure
  - complex reward systems
  - aggressive notifications
  - infinite feeds
- **Simulated audience features:** animated crowds, avatars, slide upload, eye-contact or body-language analysis, and real-time interruptions.
- **Live human practice:** real-time media, matchmaking, public profiles, chat, and community tabs, until phase 3 or 4 prerequisites are met.
- **Unsupported scoring:** any "confidence", "charisma" or mastery percentage.

---

## Appendix A: Implementation plan used for the MVP
1. **Shared domain:** types, curriculum, the evergreen library, scheduling, and text and measurement utilities.
2. **Server:**
   - configuration
   - usage meter and deduplication
   - Claude and demo coaches
   - Wikimedia content service
   - Deepgram adapter
   - routes with validation, access control and content-free logging
3. **Client:**
   - storage, routing and API wrapper
   - recorder hook and `ResponseCapture` (speak or type, transcript correction)
   - feedback and comparison panels, shared by both modes
4. **Screens:** Today, Learn, Talk, Review, Progress, Settings and Onboarding.
5. **Tests:**
   - unit tests
   - API tests with fake providers
   - jsdom journey tests against the real in-process server
   - a test that the build contains no secrets
   - Playwright walkthroughs on mobile and desktop, with a fake microphone
6. **Eval set, rubric and docs.**

## Appendix B: Decisions log
| Date | Decision | Why | Revisit when |
|---|---|---|---|
| 2026-11-02 | Wikipedia "In the news" as the first live source | Clear reuse licence, no key, revision IDs | We need mainstream news coverage or more depth |
| 2026-11-02 | Self-assessed review grading (no AI) | Free, deterministic, accepts paraphrases | Review data shows people grade themselves inconsistently |
| 2026-11-02 | Default model `claude-opus-5-5`, configurable | Coaching quality matters most at this stage | The eval set shows a cheaper model holds quality |
| 2026-11-02 | localStorage persistence | Private single-user MVP | Pilot with more than one device or user |
| 2026-11-02 | Skip tragedy items in the news feed | Practice context. Avoids casual treatment of deaths. | Users ask for harder news |
