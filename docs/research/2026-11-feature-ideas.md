# Feature ideas for Clearline — wider pass (2026-11-02)

Scope: ideas NOT already in Clearline and NOT covered by the prior pass (Yoodli, Orai, Speeko, Poised, VirtualSpeech, Toastmasters, MindShift, Wysa, Sanvello, Woebot, Lexer, Deepstash, Anki/FSRS, Duolingo). Time-boxed (~25 tool calls). Most claims are **search-indexed, not fetched** (hosts blocked or not loaded); marked `[S]`. Fetched pages marked `[F]`. All URLs accessed 2026-11-02.

Effort: S = a day or two of UI/prompt work, M = new screen + model prompt + storage, L = multi-week.

---

## A. Interview / meeting prep

### A1. Situation-tagged question bank with "talking points" feedback (not grades)
- **What:** Google Interview Warmup transcribes an answer, then highlights (a) job-related terms used, (b) words repeated 3+ times with alternatives, (c) which "talking points" were covered (Experience, Skills, Lessons Learned, Goals, Interests). Explicitly no grading; questions written by humans, not AI; audio not saved, transcript downloadable. `[S]` https://grow.google/interview-warmup ; https://9to5google.com/2022/05/17/google-interview-warmup/
- **Fit:** Matches Clearline's "no fake scores" stance exactly. Add a "What did you cover?" coverage map after an explain-from-memory or Q&A rehearsal, plus "you leaned on these 3 words" with alternatives drawn from the phrase bank.
- **Effort:** S–M (one LLM pass over the existing transcript).

### A2. STAR / answer-builder scaffold that saves answers
- **What:** Big Interview's Answer Builder walks users through STAR steps for common prompts ("tell me about yourself") and stores/exports finished answers; AI mock-interview feedback is noted as "less nuanced than human coaching". `[S]` https://careers.umbc.edu/tools/big-interview/ ; https://igotanoffer.com/en/advice/big-interview-alternatives
- **Fit:** A "story cards" mini-library: user builds 5–8 STAR stories once, then rehearsal Q&A pulls from them ("which story fits this question?"). Reuses phrase bank + spaced reviews.
- **Effort:** M.

### A3. Practice against a real job posting / real meeting agenda
- **What:** Huru's Chrome extension derives questions from a LinkedIn/Indeed/Glassdoor job listing; Final Round AI sells "industry-specific scenarios". Claimed 20k+ question bank (unverified). `[S]` https://www.finalroundai.com/blog/huru-review-pros-cons ; https://webcatalog.io/en/apps/huru/mobile
- **Fit:** "Paste the agenda / job post / email thread" -> Clearline generates the likely questions for simulated-audience Q&A. No scraping needed; paste-only.
- **Effort:** S (prompt + textarea).

## B. Impromptu / structured speaking methods (teachable in ~3 minutes)

### B1. "What? So what? Now what?" as a drillable structure
- **What:** Matt Abrahams' favourite structure for off-the-cuff answers; he stresses "you have to drill it", and offers problem–solution–benefit and past–present–future as alternatives. `[S]` https://gsb.stanford.edu/insights/three-guiding-principles-successful-communication ; https://www.gsb.stanford.edu/index%2Ephp/insights/quick-thinks-tips-speaking-virtual-meetings
- **Fit:** Add as a one-skill option in explain-from-memory: coaching checks only "did each of the three parts appear, in order?". Also a 30-second "say it in three sentences" variant.
- **Effort:** S.

### B2. PREP (Point–Reason–Example–Point) with scripted sentence stems
- **What:** Widely-taught impromptu structure; a Toastmasters-style sheet gives stems ("The point I want to make is...", "In summary my point is..."); one teaching resource recommends a daily drill of one PREP rep on a random topic, 60s, recorded. `[S]` https://courses.lumenlearning.com/suny-oswego-businesscommunicationmgrs2/chapter/11-3-impromptu-speech/ ; https://www.scribd.com/document/595055116/Impromptu-Guidelines
- **Fit:** Sentence stems go straight into the phrase bank as a "structure stems" category; the 60s-random-topic drill is a 2-minute daily mode.
- **Effort:** S.

### B3. "Maximize mediocrity" / conversation-not-performance reframe
- **What:** Abrahams' anxiety step: lower the bar to "good enough", treat the moment as a conversation/opportunity rather than a performance/threat; he recommends a personal Anxiety Management Plan. `[S]` https://thinkers50.com/?p=82714 ; https://www.rolandberger.com/en/Insights/Publications/Matt-Abrahams-on-speaking-well-when-on-the-spot.html ; https://hsuuntied.com/mabrahams/
- **Fit:** A one-line pre-rehearsal prompt ("Aim for a B-minus answer this time") and a short "my anxiety plan" card inside the CBT self-check. Pairs with D1/D3 below.
- **Effort:** S.

### B4. Three ways to enter a conversation (paraphrase / ask / name an emotion)
- **What:** Abrahams' Quick Thinks episode on speaking up in virtual meetings. `[S]` https://www.globalplayer.com/podcasts/episodes/7DrquC8
- **Fit:** "Meeting entry lines" drill: given a short transcript snippet, user records a 10-second entry using one of the three moves. Addresses the freeze-in-meetings user.
- **Effort:** S–M.

## C. Thought-to-speech / fluency

### C1. Timed semantic/phonemic word-retrieval sprints (COWAT-style)
- **What:** Flowency sells 60-second "verbal fluency drills" adapted from the COWAT neuropsych task (category/letter fluency, synonym recall). No independent trials in healthy adults; evidence is for the task type, not the app. `[S]` https://apps.apple.com/us/app/flowency/id6504569940
- **Fit:** A 60-second warm-up before rehearsal ("name 15 things related to your topic"), framed honestly as a warm-up, not a treatment. Low risk, cheap.
- **Effort:** S.

### C2. Stuttering-therapy "easy onset / light contact / preparatory set" micro-skills
- **What:** Stamurai offers 30+ exercise videos (pull-outs, easy onsets, cancellations, light contacts), self-assessment, moderated group calls; users praise "useful exercises, gradual progress", complain about price/bugs. `[S]` https://stamurai.com/ ; https://appfollow.io/android/stamurai-stuttering-therapy/com.stamurai.stamurai?country=us
- **Fit (limited):** Only the "start the first word softly, then pause" idea transfers to freezers; add as an optional single-skill focus ("soft start, then one sentence"). Do not import clinical stuttering tools.
- **Effort:** S.

### C3. Human-in-the-loop async review (Speechling model)
- **What:** Speechling's differentiator is asynchronous human coach review of recordings (~24h), with a generous free tier; critics note delay and narrow sentence-repetition focus. `[S]` https://discoverdiscomfort.com/speechling-review-language-learning-free/ ; https://speechling.com/help/checking-feedback
- **Fit:** Not as paid coaches, but as the pattern for E1 (send a clip to one trusted person, get one structured reply).
- **Effort:** see E1.

## D. Micro-reflection with evidence

### D1. "I am excited" reappraisal line before rehearsal
- **What:** Brooks (2014), JEP:General 143(3): saying "I am excited" vs "I am calm" before a 2-minute persuasive speech produced speakers rated more persuasive/confident; effect also in karaoke and math. `[S]` https://pubmed.ncbi.nlm.nih.gov/24364682/ ; https://www.apa.org/news/press/releases/2013/12/performance-anxiety
- **Fit:** A single tappable line on the pre-rehearsal screen ("Say out loud: I'm excited"); optional, never a score. Slots into the existing thought-reframing module.
- **Effort:** S.

### D2. 7-minute expressive writing before a high-stakes talk
- **What:** Ramirez & Beilock (2011), Science 331:211–213: writing about worries for ~10 min before a high-pressure test removed the "choke" (control −12%, writers +5% in lab; classroom RCT benefit confined to anxious students; writing had to be about the test, not generic). `[S]` https://www.sciencedaily.com/releases/2011/01/110113141605.htm ; https://news.uchicago.edu/story/writing-about-worries-eases-anxiety-and-improves-test-performance
- **Fit:** "Before the real thing" mode: a timed, private free-write box prompted "what are you worried will happen?", discarded after. Target only users who rate the event as scary.
- **Effort:** S.

### D3. Distanced self-talk ("[Name], you can handle this")
- **What:** Kross et al. (2014), JPSP 106(2), 7 studies n=585: using your own name/"you" instead of "I" when preparing for a speech led to challenge (not threat) appraisal, better-rated performance, less post-event rumination. Replication of physiological effects mixed (Streamer 2017). `[S]` https://rascl.berkeley.edu/assets/files/self-talk_as_a_regulatory_mechanism_how_you_do_it_matters.pdf ; https://bulletproofmusician.com/gain-a-psychological-edge-by-talking-about-yourself-in-the-third-&
- **Fit:** Thought-reframing module: rewrite the user's reframe in second person using their name ("Sam, you've explained this before").
- **Effort:** S.

### D4. WOOP / mental contrasting + if-then plans for the 4-week plan
- **What:** MCII meta-analysis (Wang et al. 2021, 21 studies, n≈15,900): g = 0.34 on goal attainment; larger with interaction (0.47) than written-only (0.28); publication bias flagged. Implementation intentions alone d ≈ 0.65 (Gollwitzer & Sheeran). `[S]` https://pmc.ncbi.nlm.nih.gov/articles/PMC8149892 ; https://pubmed.ncbi.nlm.nih.gov/30879403/
- **Fit:** Week-1 onboarding of the 4-week plan becomes a 3-minute WOOP: Wish, Outcome, Obstacle ("I freeze when asked a follow-up"), Plan ("If asked a follow-up, then I say 'Good question, the short answer is…'"). The "then" line auto-enters the phrase bank. Brave steps get an if-then line each.
- **Effort:** S–M.

### D5. Intention questions instead of nags ("reminders that ask")
- **What:** Question-behavior effect meta-analysis (Wood et al. 2016, 116 tests): d = 0.24 overall, larger for easy, desirable behaviours; weak/absent in large public-health RCTs. `[S]` https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4899924/ ; https://www.frontiersin.org/articles/10.3389/fpsyg.2016.00879/pdf
- **Fit:** Any email/push copy becomes "Will you do one 2-minute rep before lunch today? (yes/not today)". Modest effect, zero cost, consistent with no-guilt tone.
- **Effort:** S.

## E. Accountability / social without infrastructure

### E1. Share one clip, ask for one word
- **What:** Speechling-style async human review (C3) but peer-based; Interview Warmup's shareable transcript. `[S]` sources as C3/A1.
- **Fit:** "Send to one person" generates a link to the recording + a 3-option reply form ("clearest moment / one thing to cut / one word"). Replies land in observer listen-back. No accounts for the reviewer.
- **Effort:** M (signed share link + tiny reply endpoint).

### E2. Body-doubling (concept only)
- **What:** Focusmate: 5M+ sessions, but CHADD notes little validating research; a small 2025 EEG study reportedly found no effect. `[S]` https://chadd.org/adhd-news/adhd-news-adults/could-a-body-double-help-you-increase-your-productivity/ ; https://blog.saner.ai/focusmate-review/
- **Fit:** Skip live pairing. Cheapest echo: a "someone else is also rehearsing right now" presence count is a gimmick — avoid.
- **Effort:** n/a.

## F. Memory / learning

### F1. "Prepare to teach" framing + teach-it-to-a-12-year-old
- **What:** Nestojko et al. (2014), Memory & Cognition 42:1038–1048: merely expecting to teach produced better organised recall than expecting a test (n=56). Fiorella & Mayer: preparing + actually explaining gives durable gains; some null results exist. Dunlosky (2013) rates elaborative interrogation/self-explanation "moderate utility". `[S]` https://source.washu.edu/?p=70030 ; https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-learning-by-teaching-fiorella.pdf ; https://teaching.berkeley.edu/node/114
- **Fit:** Explain-from-memory gets an audience selector: "a smart 12-year-old / a sceptical VP / a new hire". AI coaching asks one "why is that true?" follow-up (elaborative interrogation) rather than general feedback.
- **Effort:** S.

### F2. Resurface your own best lines (Readwise pattern)
- **What:** Readwise's daily email/app resurfaces highlights on a spaced schedule; users praise the daily habit, unexpected connections, and "a few minutes a day is enough"; criticism: thin library -> thin reviews. `[S]` https://apps.apple.com/us/app/-/id1476885528 ; https://dev.to/airabbit/apply-scientific-learning-concepts-using-readwise-16cp
- **Fit:** Spaced review already exists; extend it to resurface the user's own best 10-second clips and phrase-bank lines ("You said this well on Oct 12 — say it again now"). Self-generated items, not third-party quotes.
- **Effort:** S–M.

## G. Behaviour change

### G1. Tiny Habits anchor + celebration
- **What:** Fogg's recipe "After I [anchor], I will [tiny behaviour], then celebrate". Evidence is mostly program data (40k+ participants) and an unpublished celebration experiment; no independent RCT found. `[S]` https://ruralhealth.utah.gov/wp-content/uploads/Tiny_Habits_Summary.pdf ; https://conversionsciences.com/wp-content/uploads/2020/06/Changing-Habits-with-Behavioral-Design-Conversion-Sciences.pdf
- **Fit:** Plan onboarding asks "after which daily thing will you do a 2-minute rep?"; after each rep, a one-tap "what went OK?" prompt (celebration-as-noticing, no confetti).
- **Effort:** S.

### G2. Guided weekly review / shutdown ritual (Sunsama pattern)
- **What:** Sunsama's guided daily shutdown and rebuilt weekly review; reviewers call the shutdown "deceptively powerful" for closing loops and the app "a behaviour coach, not a storage bin". `[S]` https://help.sunsama.com/docs/daily-shutdown ; https://roadmap.sunsama.com/changelog/weekly-review-20 ; https://blog.saner.ai/sunsama-reviews
- **Fit:** End of each plan week: 3 questions (what got clearer, what still freezes you, one brave step next week) with the AI summarising the week's rehearsals. Replaces streaks as the progress signal.
- **Effort:** S–M.

---

## Top 10 for Clearline (benefit × feasibility)
1. **D4 WOOP + if-then plans** in the 4-week plan; "then" lines feed the phrase bank (strongest evidence, S–M).
2. **B1 What/So what/Now what** as a drillable single skill (S).
3. **A1 Coverage map + repeated-word hints**, no grade (S–M).
4. **F1 Audience selector + one "why?" follow-up** in explain-from-memory (S).
5. **D1 "I'm excited" line** before rehearsal (S).
6. **D3 Name-based self-talk** in reframing (S).
7. **G2 Weekly review ritual** replacing streak-style progress (S–M).
8. **A3 Paste agenda/job post -> predicted questions** for simulated Q&A (S).
9. **D2 Pre-event worry write-out**, shown only for events rated scary (S).
10. **E1 Share one clip, ask for one word** (M, but unlocks real-world feedback).

Also worth doing cheaply: B2 PREP stems, B3 "aim for B-minus", C1 60s word sprints, F2 resurface own clips, D5 asking reminders, G1 anchor question.

## Avoid
- Live body-doubling / presence counters (E2): weak evidence, infra cost, gimmick risk.
- Clinical stuttering toolkits, DAF, severity assessments (C2): wrong population, medical-claim risk.
- Big question banks (20k items) or job-board scraping (A3 as Huru does it): maintenance burden, little marginal value over paste-your-own.
- Multi-dimension AI scoring ("16 dimensions", Final Round/Big Interview): contradicts the no-fake-scores principle and is rated less nuanced than human feedback.
- Celebration as confetti/badges: the Fogg evidence is thin; keep it as a reflective one-tap.
- Quoting "learning pyramid" / 90% retention claims for teach-back: unverified, debunked-style numbers.

## Not reachable this pass
- oren.github.io (Abrahams summary) failed DNS; grow.google, Stanford GSB and PMC pages were search-indexed only.
