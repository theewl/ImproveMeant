# Competitive and provider notes (2026-11)

All sources accessed 2026-11-01.

**Method caveat:** In this session, the network policy blocked direct page fetches (WebFetch/curl) to every target host: yoodli.ai, orai.com, apps.apple.com, theguardian.com, deepgram.com, toastmasters.org and deepstash.com. The proxy returned 403 on CONNECT. Search queries restricted to `theguardian.com` were also refused. Every claim below therefore comes from search-engine results that index the cited URL, and none comes from reading the page itself. Treat each one as **"search-indexed, not directly fetched"**, and re-check it against the live page before using it in code or pricing models. Anything I could not confirm is marked "not verified".

---

## Part A: Competitors

### 1. Yoodli (AI speaking coach and roleplay)
- **What it does:** An AI speech coach. Its speaking report covers pacing, filler words and word choice, and adds "concrete suggestions". It also runs AI roleplays against simulated audiences, including skeptical Q&A and multi-persona scenarios. Sources: https://yoodli.ai/use-cases/public-speaking, https://yoodli.ai/platform/ai-feedback (accessed 2026-11-01).
- **Core workflow:** Record or upload a video, or let Yoodli join Zoom calls silently. You get a transcript, analytics and timestamped feedback that you can share with friends or coaches. Source: https://virtualspeechcoach.yoodli.ai/ (accessed 2026-11-01).
- **Pricing:**

  | Plan | Price | Includes |
  |---|---|---|
  | Starter | Free | 5 lifetime sessions |
  | Pro | $8/mo, billed annually | Up to 10 roleplays per week |
  | Advanced | $20/mo, billed annually | Unlimited roleplays; data excluded from AI training |
  | Team / Enterprise | Custom, per seat | Rubric scoring, manager dashboards, SSO, LMS/HRIS integrations |

  On Starter and Pro, session data may be used to improve the platform. The two pricing pages name the team tier differently. Sources: https://yoodli.ai/pricing, https://e.yoodli.ai/pricing, https://support.yoodli.ai/en/articles/9554779-subscriptions (accessed 2026-11-01).
- **Audience:** Individuals preparing for interviews and public speaking, and an enterprise segment for sales enablement and L&D. Source: https://yoodli.ai/use-cases/interview-preparation (accessed 2026-11-01).
- **Notable:** Yoodli says it partnered with Toastmasters International to roll out to roughly 300k members. Source: https://yoodli.ai/blog/toastmasters-speech-contest-yoodli (accessed 2026-11-01; partnership terms not verified). Feedback centres on metrics plus suggestions. I found no peer-reviewed evidence claims (not verified).

### 2. Orai (speech practice app)
- **What it does:** Scores filler words, pace, clarity and energy as soon as you finish speaking. It runs on web, iOS and Android. Orai describes itself as practice-first, so it is not a live in-call tool. Sources: https://orai.com/, https://orai.com/alternatives/yoodli/ (accessed 2026-11-01).
- **Core workflow:** Record a practice speech, get instant metric scores, and work through guided lessons. Source: https://orai.com/journey/ (accessed 2026-11-01).
- **Pricing:**
  - $12/month
  - $49.99/year
  - $149 lifetime
  - 7-day Pro trial, card required

  Source: https://orai.com/pricing/ (accessed 2026-11-01). The indexed pricing page may be older than the rest of the site, so re-check it.
- **Audience:** Individuals improving their public speaking.
- **Notable:** Feedback is metric-driven: counts and scores rather than coaching on message structure. The comparison pages are vendor-written.

### 3. "Spoken" / Spoken AI (news plus AI conversation)
- **Correct product (best match):** "Spoken AI – English Speaking / Learn English", iOS app id6496860947. Sources: https://apps.apple.com/app/id6496860947, https://spokenai-web.pages.dev/ (accessed 2026-11-01).
- **What it does:** It rewrites each news story to the learner's level (Beginner, Intermediate or Advanced), and the learner then discusses it with an AI. Premium adds unlimited practice, all scenarios and "advanced analytics".
- **Pricing (US App Store in-app purchases):**
  - 1 month: $19.90
  - 3 months: $29.90
  - 6 months: $79.99

  Prices vary by storefront. Source: https://apps.apple.com/app/id6496860947 (accessed 2026-11-01).
- **Audience:** English learners (ESL), not native-speaking professionals.
- **Notable:** It self-reports "10,000+ learners" and a 4.8/5 rating (not verified).
- **Ambiguity:** Several similar apps exist: TalkAI, SpeakMate, ChatSpeak, Speak, Praktika. "Spoken" (spokenaac.com) is an unrelated AAC app. A source listing these: https://www.issen.com/blog/best-ai-apps-practicing-language-real-conversations (accessed 2026-11-01).

### 4. Lexer (news vocabulary plus spaced review)
- **Correct product (best match):** "Lexer: Vocabulary Flashcards — Learn English Words from Real News". Source: https://lexervocabulary.com/ (accessed 2026-11-01).
- **What it does:** It picks level-appropriate English words from recent news and shows each word in its original sentence, with the article title and category. Reviews are scheduled with FSRS spaced repetition. The App Store listing reportedly offers 5 new words a day with a capped daily review count (listing not fetched; not verified).
- **Pricing:** not verified.
- **Audience:** English vocabulary learners.
- **Ambiguity:** Similar apps include Lexa, Lexicon, LexIQ, Readle, Level Read, Ladder News and Newslang. Source: https://apps.apple.com/us/app/learn-english-news-by-readle/id6450111879 (accessed 2026-11-01).

### 5. Deepstash (short-form idea learning)
- **What it does:** Microlearning built from bite-sized "ideas" taken from books and articles. Its tagline is "Replace doomscrolling with microlearning". Source: https://deepstash.com/ (accessed 2026-11-01).
- **Core workflow:** Browse ideas, save them ("stash"), listen to them, and follow "journeys".
- **Pricing:**
  - Pro adds unlimited saves, unlimited listening, offline access, no ads and 100+ journeys.
  - A Lifetime Pro option exists.
  - The dollar price is not published on the indexed pages; it is shown in-app (not verified).

  Sources: https://i.deepstash.com/get-pro, https://deepstash.com/terms-of-service (accessed 2026-11-01).
- **Audience:** Self-improvement readers.
- **Notable:** The learning is passive consumption. I found no recall, speaking or feedback loop (not verified).

### 6. Toastmasters International
- **What it does:** In-person and online clubs where members give prepared and impromptu speeches. Learning follows the Pathways curriculum, and members evaluate each other's speeches. Source: https://toastmasters.org/education/education-programs-faq (accessed 2026-11-01). The evaluation format is from general knowledge; the details were not verified in this session.
- **Dues:**
  - Semiannual international dues rose from $60 to $72 from 2026-08-03.
  - The new-member fee is $25 (raised from $20 on 2025-10-01).
  - Clubs may add their own dues.
  - The first Pathways path is included; each additional path costs $35.

  Sources: https://www.toastmasters.org/magazine/magazine-issues/2026/august/update-membership-dues, https://www.toastmasters.org/footer/faq/dues-increase, https://www.toastmasters.org/footer/faq/Membership-Dues-and-Payments (accessed 2026-11-01).
- **Audience:** Broad, adult and professional.
- **Notable:** It is the only option here with real human listeners and structured peer evaluation. The cost is a fixed meeting schedule, and the evaluators are untrained peers.

### Substitutes
- **ChatGPT or Claude voice mode:** You can explain an idea aloud for free or cheaply and ask for critique, but you have to supply the structure, spacing and follow-up yourself (general knowledge; not verified here).
- **Recording yourself on a phone:** Free, and it gives you some self-awareness, but there is no diagnosis or plan.
- **Speeko (iOS):**
  - Full Access: $24.99/mo or $99.99/yr
  - Access-only: $69.99/yr

  Source: https://apppricinglab.com/iap/apple/1071468459 (third-party snapshot of App Store in-app purchases, accessed 2026-11-01). Older listings show $19.99/mo.
- **Poised (live meeting communication coach):** Prices are not verified; third-party sites conflict at $13 to $19/mo. Source: https://www.spotsaas.com/compare/speeko-vs-poised (accessed 2026-11-01).
- **Human speaking coach:** Highest quality and highest cost. Rates not verified.

### Overlaps with our concept
- Spoken AI already pairs news content with spoken AI conversation, but it is aimed at ESL learners and is about language practice, not communication skills.
- Lexer and Readle already pair news with spaced review, but only for vocabulary.
- Yoodli, Orai and Speeko already give AI feedback on recorded speech: filler words, pace, clarity, and roleplay in Yoodli's case.
- Deepstash already turns interesting ideas into short daily sessions.
- Toastmasters already provides human listener feedback and structured progression.

### Gaps none of them clearly cover (based on what I could verify)
- **Explain-from-memory recall** of a piece of content (the generation effect) that is then graded as a communication task. Spoken AI discusses the news; it does not test whether you can retell it concisely.
- **Coaching on one skill at a time** (for example, bottom line first) with an immediate retry on the same content. The others either show broad metric dashboards (Orai, Yoodli) or run open-ended conversation.
- **Spaced application of the communication skill itself**, as opposed to spaced vocabulary (Lexer) or no spacing at all (Yoodli, Orai).
- **Asynchronous feedback from a real human listener on whether the message landed**, without a club schedule. Toastmasters needs a live meeting; Yoodli's "share with coach" is not a structured listener protocol (not verified in depth).
- **A positioning gap:** none of them targets native-English early-career professionals who ramble in meetings. They aim at ESL learners, public speakers or enterprise sales.

---

## Part B: Provider facts

### 1. Guardian Open Platform Content API
I could not reach the official docs at open-platform.theguardian.com: fetches and domain-restricted searches were both blocked. Everything in this section is **not verified against official docs**.
- **Search endpoint:** `GET https://content.guardianapis.com/search?q=...&api-key=KEY`. Results are at `response.results[]`. A single item is at `GET https://content.guardianapis.com/{id}` and is returned at `response.content`. Source: https://huggingface.co/spaces/rushankg/memetoday/blob/main/guardian.py (community code, accessed 2026-11-01).
- **Body text:**
  - `show-fields=bodyText` returns plain text at `fields.bodyText`.
  - `show-fields=body` returns HTML.
  - `show-fields=all` returns every field.
  - Other selectable fields include `headline`, `trailText`, `byline`, `wordcount` (returned as a string), `lastModified` and `shortUrl`.

  Source: https://cran.r-project.org/web/packages/guardianapi/refman/guardianapi.html (R package docs, accessed 2026-11-01).
- **Dates:** `webPublicationDate` is a top-level property of each result (ISO 8601). `lastModified` is available through `show-fields`. Sources: same as above, plus https://gist.github.com/dannguyen/c9cb220093ee4c12b840 (accessed 2026-11-01).
- **"test" key:** Historically, `api-key=test` worked. A GitHub issue reports that it now returns 401, so a personal key is needed (not verified). Source: https://github.com/sameames18/music-discovery/issues/25 (accessed 2026-11-01).
- **Developer key rate limits:** Sources conflict and none is official.
  - Recent secondary sources say up to 1 call/second and 500 calls/day.
  - Older sources say 12 calls/second and 5,000 calls/day.
  - Response headers reportedly report the remaining daily and per-minute quota.

  Sources: https://github.com/jbenton/guardian-mcp-server, https://groups.google.com/g/guardian-api-talk/c/tp0VfMcamcY, https://freeapihub.com/apis/guardian-api (accessed 2026-11-01).
- **Terms (not verified; no official quote obtainable):** Secondary sources say the free Developer key is for **non-commercial use only**, and that commercial products need a commercial key or agreement. Those sources say AI/ML training is excluded from the free tier. Source: https://freeapihub.com/apis/guardian-api (accessed 2026-11-01). I could not obtain quotes on attribution, caching or storage limits, or whether full content may be displayed. **Action:** read https://open-platform.theguardian.com/access/ and the Terms and Conditions linked from it before building on this API. That matters especially because our product would be commercial and would send article text to an LLM.

### 2. Deepgram pre-recorded transcription
- **Endpoint:** `POST https://api.deepgram.com/v1/listen`. Source: https://developers.deepgram.com/docs/pre-recorded-audio (accessed 2026-11-01).
- **Auth:** `Authorization: Token <DEEPGRAM_API_KEY>`. The scheme is `Token`, not `Bearer`. Same source.
- **Raw bytes:** Send the binary body with an audio content type, for example `Content-Type: audio/wav` or `audio/mp3` (`--data-binary @file`). For a remote URL, send `Content-Type: application/json` with the body `{"url": "..."}`. Sources: https://developers.deepgram.com/docs/pre-recorded-audio, https://developers.deepgram.com/docs/diarization (accessed 2026-11-01).
- **Model:** `model=nova-3`, the model the docs' examples use. If you omit `model`, it defaults to `base`. Sources: https://developers.deepgram.com/docs/pre-recorded-audio, https://deepgram.com/learn/model-comparison-when-to-use-nova-2-vs-nova-3-for-devs (accessed 2026-11-01).
- **Useful query parameters:**
  - `smart_format=true`: readability formatting, and adds `punctuated_word` to each word.
  - `punctuate=true`: default false.
  - `language=en`
  - `diarize`, `paragraphs`, `utterances`
  - `filler_words`: probably useful for us; the parameter name is from general knowledge and was not verified here.

  Source: https://developers.deepgram.com/docs/punctuation (accessed 2026-11-01).
- **Response paths:**
  - Transcript: `results.channels[0].alternatives[0].transcript`
  - Transcript confidence: `results.channels[0].alternatives[0].confidence`
  - Words: `results.channels[0].alternatives[0].words[]`, each with `word`, `start` and `end` (seconds), `confidence`, and `punctuated_word` when smart formatting is on.

  Sources: https://developers.deepgram.com/docs/multichannel, https://developers.deepgram.com/docs/confidence (accessed 2026-11-01).
- **Pricing (unclear for pay-as-you-go pre-recorded):**
  - The pricing page lists Nova-3 pay-as-you-go at $0.0077/min (monolingual) and $0.0092/min (multilingual). The page reportedly notes that pre-recorded is cheaper, so these look like streaming rates.
  - Growth tier: $0.0065/min, with a $4k/yr prepaid commitment.
  - Deepgram blog pages cite pre-recorded pricing "starting at $0.0043/min".

  The exact pay-as-you-go batch rate is not verified. Sources: https://deepgram.com/pricing, https://deepgram.com/learn/deepgram-vs-google-vs-assemblyai (accessed 2026-11-01).
- **Data retention:**
  - By default, requests take part in the Model Improvement Program and Deepgram **retains** them.
  - Adding `mip_opt_out=true` to the query string gives zero data retention for that request: no audio or transcript is stored after the response. Usage logs and metadata are still kept.

  Sources: https://developers.deepgram.com/trust-security/your-data, https://developers.deepgram.com/docs/the-deepgram-model-improvement-partnership-program (accessed 2026-11-01). **Recommendation:** always send `mip_opt_out=true`, because user voice recordings are sensitive.

### 3. Anthropic API pricing
- **Pricing page:** https://platform.claude.com/docs/en/about-claude/pricing (accessed 2026-11-01). The page is search-indexed, and the indexed copy looked internally inconsistent: it showed no Sonnet 5.5 row.
- **Prices from the per-model pages** (not verified on the pricing page itself):

  | Model | Input / output per MTok | Notes |
  |---|---|---|
  | claude-opus-5-5 | $4 / $20 | Cache read $0.20; batch −50%. Source: https://platform.claude.com/docs/en/models/opus-5-5/overview |
  | claude-sonnet-5-5 | $2 / $10 | Cache read $0.10. Source: https://platform.claude.com/docs/en/models/sonnet-5-5/overview |
  | claude-haiku-5-5 | $0.10 / $0.50 for prompts ≤100K tokens; $0.50 / $2.50 for prompts >100K | Source: https://platform.claude.com/docs/en/models/haiku-5-5/overview |

  All accessed 2026-11-01. Confirm these on the live pricing page before budgeting.
