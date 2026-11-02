# Code review B: would this actually help someone who rambles, freezes or gets anxious when speaking?

**Reviewer lens:** product + learning science, with front-end checks. **Date:** 2026-11-02. **Branch:** `claude/confidence-cbt` at `e1132bc` plus the uncommitted working tree at the time of writing (pause/waveform, activity dots).
**Method:** read-only review of README, MASTER_PLAN §3/§9, `src/shared/{curriculum,confidence,plan,safety,schedule,observations}.ts`, `src/server/coach/{prompts,schemas,claude,demo}.ts`, every screen and component in `src/client/`, `eval/RUBRIC.md` and the research notes. `npm test` run once: 106/106 pass. No files modified; no dev server run.
Commits `5313ffc` (feedback usefulness rating, within-skill exercise progression, local-day fix) and `e1132bc` (if-then plans, worry box, "I'm excited" line, notes coverage, distanced self-talk hint, one-question self-check, share clip, three-part look-back, two new exercises) landed mid-review; findings below are against the code after both.

Line numbers are from the working tree at the time of writing; the branch is moving, so treat them as anchors, not gospel.

---

## 0. Verdict in one paragraph

The core loop (read → explain from memory → one grounded coaching point → optional retry → spaced re-application) is sound, unusually honest, and better engineered against AI failure modes than most products in this space (quote verification, no scores, demo mode that refuses to pretend, no streaks). For a *rambler* it will plausibly help, because the exercises target exactly the structural habits that cause rambling and the coach is forced to be specific. For a *freezer* or an *anxious speaker*, the Confidence tools are built on the right model (behavioural experiments, graded steps, outward attention, post-event guard) but several defaults and progression rules quietly undermine the one thing those tools depend on: honest self-report. Three UI defaults manufacture "improvement" the user never reported (observer review, belief re-rating, rehearsal prediction), the ladder uses a habituation criterion the app's own research rejects, and the real-world transfer story is split across two unconnected features. None of this is hard to fix. The ranked list is below; the first six items are the ones that would change outcomes.

---

## 1. Ranked findings

| # | Impact | Finding | Where |
|---|---|---|---|
| 1 | **High** | Observer-review sliders default to predicted 4 / observed 5, so a user who touches nothing records "came across better than it felt" | `ResponseCapture.tsx:104-105`, `:256`; counted in `Progress.tsx:141` |
| 2 | **High** | "Untangle a thought" defaults belief-before 70% and belief-after 40%, fabricating a 30-point drop | `Confidence.tsx:530,535` |
| 3 | **High** | Talk check-in saves a fabricated prediction ("It would go badly", 50%) and rehearsal experiments are pooled with real-world ones in "X of Y feared outcomes didn't happen" | `TalkSession.tsx:429-430`; `Confidence.tsx:73-76,138-146`; `confidence.ts:110-122` |
| 4 | **High** | Ladder progression is gated on anxiety ≤ 4/10 (habituation), contradicting the expectancy-violation stance in MASTER_PLAN §9 and research A4; copy tells users to repeat "until it feels about 4/10" | `confidence.ts:91-97`; `Confidence.tsx:119,452` |
| 5 | **High** | New exercise progression counts retries and follow-up answers toward the "goal met twice" threshold, so one session can trigger "harder version" | `state.ts:130-138`; `LearnSession.tsx:70-78`; `curriculum.ts:335-340` |
| 6 | **High** | Two disconnected real-world systems (Missions on Progress; brave steps in Confidence). Logging a mission does not tick the plan's "real-world brave step" | `Progress.tsx:235-305`; `plan.ts:217`; `curriculum.ts:268-287` |
| 7 | **Med-High** | Coaching prompt lacks four guardrails: retry judged against the definition not against compliance; always a strength when on-topic; "minor_gaps" ≠ omission; never suggest fancier vocabulary | `prompts.ts:38-47,89-94`; `schemas.ts:192-195` |
| 8 | **Med-High** | Self-check result says "CBT with a therapist is the recommended treatment for social anxiety" — implies a diagnosis the app has just said it doesn't make | `Confidence.tsx:672-673` |
| 9 | **Med-High** | Plan weeks advance by calendar only. A missed week yields a look-back reading "0 sessions · 0 brave steps" followed by "One thing that went well" | `plan.ts:198-201,275-282`; `PlanCard.tsx` (`Lookback`) |
| 10 | **Med** | Talk: 11–15 taps to first feedback (Learn: 4–7); talk feedback withheld until after Q&A; the button after recording says "Continue", not what comes next; no skip while "the audience is thinking" | `TalkSession.tsx:324,334-356` |
| 11 | **Med** | `mp-explain-story` success definition bakes fidelity into `goalMet`, while the system prompt says to keep fidelity separate | `curriculum.ts:41`; `prompts.ts:43` |
| 12 | **Med** | Starter ladder has no 1–2/10 rungs; thinking traps omit *emotional reasoning* (central to Clark & Wells) | `confidence.ts:71-78`, `:8-57` |
| 13 | **Med** | End-of-talk transfer hint is hard-coded to "open with your main point" regardless of the skill practised | `TalkSession.tsx:444` |
| 14 | **Med** | Talk setup labels: "Topic" for the persuasive scenario needs a *position*; the required "Where you're introducing yourself" field is never used in the task text | `TalkSession.tsx:237`; `curriculum.ts:63-64` |
| 15 | **Low-Med** | Copy drift: practise/practice, organise/organize; "brave step" vs "experiment" vs "real-world attempt" vs "mission"; "in a few days" when the first review is tomorrow | multiple; see §5 |
| 16 | **Low-Med** | Onboarding "main goal" is collected and never read | `Onboarding.tsx:7-12,27`; no other reader of `prefs.goal` |
| 17 | **Low** | "Opening sentence: N words" is shown with no target, inviting "shorter is better" | `observations.ts:23` |
| 18 | **Low** | Pending brave-step check-ins only surface in the Confidence tab; no "when" field, so Today can't say "How did Tuesday's meeting go?" | `Confidence.tsx:100-107,281-380` |
| 19 | **Low-Med** (new in `e1132bc`) | Two unattributed "In one study…" outcome claims in product copy (worry box; "I'm excited"). MASTER_PLAN §9 says verify sources before public copy and don't borrow outcome results | `Confidence.tsx:361-365`; `TalkSession.tsx:630-633` |
| 20 | **Low-Med** (new in `e1132bc`) | "Notes covered: X of Y" on the talk feedback screen is a coverage ratio; for a rambler it rewards saying everything in the notes, the opposite of the skill being coached | `TalkSession.tsx:456-477`; `observations.ts:99` |

---

## 2. Learning loop integrity

### 2.1 Does attempt → feedback → retry → later application hold?

**Mostly yes, and the honest parts are the strong parts.**

- The briefing is hidden before recall, reopening marks the attempt *assisted*, and the coach is told (`prompts.ts:74`). Good.
- Feedback quotes are verified against the response and dropped if fabricated (`claude.ts:232-259`), and the UI says how many were dropped (`Feedback.tsx:113`). This is the single most important anti-generic-praise mechanism and it is implemented correctly.
- Retry is capped at 2, shows the retryFocus, and the comparison panel explicitly says "a good sign, not mastery" (`Feedback.tsx:169`).
- Later application via FSRS reviews with a `laterVariation` in a new context (`state.ts:52-61`) is exactly the transfer step most apps skip.

**Where it leaks:**

**(a) Progression counts the wrong attempts (finding 5).** `summarize()` increments `goalMetLive` for *every* live attempt in a completed session under the session's skill (`state.ts:130-138`). That includes (i) retries of the same prompt and (ii) follow-up answers, which were evaluated against `fu-answer-directly`, not the session's exercise. With `PROGRESSION_THRESHOLD = 2`, a first attempt that meets the goal plus one retry that also meets it moves the learner to the "harder version" after one session, on one topic. Fix: count only non-retry, non-follow-up attempts (`!a.isRetry && !s.followUps.some(f => f.answer?.id === a.id)`), and require the two to be in different sessions. Consider raising the threshold to 3.

**(b) `goalMet` conflates structure and accuracy for the most-used exercise (finding 11).** `mp-explain-story`'s definition ends "…and nothing important is factually wrong" (`curriculum.ts:41`). The system prompt tells the model fidelity is a separate dimension (`prompts.ts:43`). The model will resolve the conflict unpredictably: sometimes `goalMet:false` for a well-structured but slightly inaccurate explanation, which teaches the learner the wrong lesson about what the skill is. Fix: drop the fidelity clause from the definition; fidelity already has its own field and its own UI block.

**(c) Retry evaluation can reward compliance rather than clarity.** The retry instruction (`prompts.ts:93`) asks the model to "say concretely what changed." Nothing stops it from marking the goal met because the learner did what it suggested. Add: *"Judge the retry against the definition of success, not against whether the learner followed your previous suggestion. If following it made the response worse, say so."*

**(d) Transcript editing before feedback.** A spoken learner can rewrite the transcript freely before submitting (`ResponseCapture.tsx:338-345`). It is flagged ("Transcript edited") and the original is stored, but the coach is told it was "corrected" (`prompts.ts:72`), which invites the model to treat it as faithful. For anxious users there is a real pull to polish before being judged. Low-cost mitigation: when the edit distance is large (say >25% of words changed), tell the coach "substantially rewritten after transcription" and show the learner "You changed about a third of the words. Feedback is on the edited version."

**(e) Is "goal met" meaningful?** For 9 of 13 exercises, yes: the definitions are positional ("first sentence", "last sentence", "before background details") or countable ("two separate supports that don't repeat"). Four are soft enough that two reasonable judges would disagree:
- `org-explain-group`: "sensible order", "no long detours" (`curriculum.ts:103`). Suggest: "supports are announced before they are given (e.g. 'two things matter'), and no single aside runs longer than the point it supports."
- `mp-one-sentence`: "a listener could repeat accurately" (`:53`). Suggest: "one sentence of at most ~25 words with one subject and one claim; no 'basically', 'so', or 'I think' preamble."
- `ex-analogy`: "accurate enough not to mislead" (`:139`) requires domain judgement. Acceptable, but tell the model to flag only clear mismatches.
- `ex-persuade`: "persuasion rests on reasoning rather than volume of claims" (`:152`). Suggest: "at least one reason is developed with an example; no more than three unsupported claims."

**(f) Does the app reward the wrong thing anywhere?** Checked for: length (no — nothing scores length; the 3-word minimum is fine), fancy words (no explicit guard; see §3), agreeing with the AI (retry issue above), typed vs spoken (tracked separately, never conflated — good). The Progress table "Goal met (AI-coached attempts)" counts retries (and says so), which mildly rewards retrying. Fine, given the caveat.

One new exception (finding 20): **"Notes covered: X of Y"** (`TalkSession.tsx:456-477`) sits directly under the coaching feedback. It is labelled "rough word match, not a grade" and hidden in quiet mode, but a ratio is a score to the person reading it, and "cover more of your notes" is the instinct that makes people ramble. The useful half is the *missed lines* list (did I forget the thing I meant to say?). Show only that, collapsed, without the X-of-Y summary, and never on exercises whose definition rewards cutting (`mp-one-sentence`, `con-takeaway`).

**(g) Demo mode.** The loop does not exist in demo mode and the app says so at every point (`Feedback.tsx:33-35`, `App.tsx:55`). Correct behaviour; just be aware that a pilot user in demo mode gets no learning benefit, so the plan's task ticks are hollow there.

### 2.2 Difficulty progression

- Learn now has within-skill progression (starter → core/stretch). Note `org-stretch-objection` ("name the objection and answer it") is a different task from "explain in two reasons", not a harder version of it; the eyebrow "· harder version" (`LearnSession.tsx:230`) will confuse. Label it by name ("Next level: Address the obvious objection") instead.
- Talk has none. Audience style (supportive/challenging) and length (60/120/180) are manual and buried under "More options" (`TalkSession.tsx:253-280`). Suggest the plan or a simple rule nudge: after two rehearsals of a scenario with goal met, default to "challenging"; after a 60-second talk is met, offer 120.
- After week 4 of the plan, "Start a new plan" repeats the identical four weeks (`PlanCard.tsx:35-46`). See §4.

---

## 3. Coaching prompt quality (`src/server/coach/prompts.ts`)

**What is good and should not be touched:** the one-strength/one-priority cap; "never manufacture a weakness"; "preserve voice, smallest change"; "many structures are valid"; the no-delivery-claims rule; "never give scores"; treating transcription errors as not the learner's; the off-topic path; the data rule. The eval rubric (`eval/RUBRIC.md`) matches the prompt criterion for criterion, which is rare and valuable.

**Gaps, each with a one-line patch:**

1. **Strength can be null on an on-topic response.** Schema allows `strength: null` (`schemas.ts:177-183`) and the prompt says "at most one strength". For anxious learners, feedback with only "Try this next" reads as a verdict. Add to `FEEDBACK_SYSTEM`: *"If the response is on topic, always include one genuine strength, even on a weak attempt; there is always something real to name (a clear phrase, a good example, the right order somewhere)."*

2. **Retry compliance** (see §2.1c). Add after `prompts.ts:93`: *"Judge the retry against the definition of success, not against whether the learner followed your previous suggestion."*

3. **"minor_gaps" is undefined and the UI renders it as an accuracy problem.** `schemas.ts:193` offers `minor_gaps`; `Feedback.tsx:67-75` shows it under an "Accuracy" heading as "Mostly matches the briefing". The model is given only `mainIdea` + `points` (`prompts.ts:78`), so a learner who mentions a detail from the source excerpts, or who omits a point, may be flagged. Define it: *"`minor_gaps` means a small inaccuracy or a claim not supported by the source. Leaving points out is never a fidelity issue; only what the learner said can be inaccurate."* Also pass `supportingExcerpts` into `<source_text>` so true details aren't marked as unsupported.

4. **Vocabulary inflation.** Nothing prevents "consider a more precise term such as 'leverage'". Add: *"Prefer plain words. Never suggest a more sophisticated word or phrase as an improvement; suggest moving, cutting or adding a sentence instead."*

5. **Quote length.** The clamp is 300 characters (`claude.ts:237`). A 50-word quote block swamps the observation. Add to the prompt: *"Quotes are at most about 15 words."* and clamp at 120 characters.

6. **Explanation length contradiction.** The prompt says "one or two sentences each" (`prompts.ts:47`); the schema says "Two or three sentences" for `explanation` (`schemas.ts:191`). Pick one (two is enough; it is hidden under "More detail" anyway).

7. **`exampleFeedback` leakage.** The style reference is clearly labelled "about a different response" (`prompts.ts:70`), but several examples contain concrete claims ("arrives in your fourth sentence"). Models do copy these. Add: *"Do not reuse any detail, count or quote from the example; derive everything from the learner's response."*

8. **Spoken transcripts without sentence boundaries.** Deepgram is called with `punctuate: true` (`deepgram.ts:37`), so first-sentence judgements are usually fine. But "typed what I said" transcripts often have no punctuation. Add: *"If the response has little punctuation, infer sentence boundaries from meaning; do not penalise missing punctuation."*

9. **Audience prompt.** Fine. One small risk: "based on what was actually said (or clearly missing)" (`prompts.ts:114`) can produce a question that is really a criticism ("You didn't give any evidence—why?"). Add: *"A question about something missing is still asked as a genuine question, not as a correction."*

10. **Opinion handling** is well specified (`prompts.ts:43`, `schemas.ts:196-199`). No change.

---

## 4. CBT tools: accuracy, tone, harm

### 4.1 Thinking traps (`confidence.ts:8-57`)
Accurate, plainly worded, no copied text. Two notes:
- **Add "Emotional reasoning"** ("I *feel* visibly nervous, so I must *look* nervous"). In the Clark & Wells model this is the mechanism that turns a felt sense into a belief about how one appears, and it is the trap the observer-review feature is designed to test. Question: *"What's the evidence from outside your body — what did people do, what did the recording show?"*
- "Spotlight effect" is a research finding rather than a classic cognitive distortion; the wording is fine. Keep.

### 4.2 Brave steps and the ladder

- **Progression criterion (finding 4).** `suggestNextStep` treats a step as done only when `anxietyAfter ≤ 4` (`confidence.ts:93`), and the copy says "Repeating a step until it feels about 4/10 is how it gets easier" (`Confidence.tsx:119`) and "Move up when a step feels manageable (around 4/10 or less)" (`:452`). This is a habituation rule. MASTER_PLAN §9 and research note A4 commit the product to expectancy violation (Craske 2014): what matters is that the prediction was tested, not that anxiety fell. A person whose anxiety stays at 7 while the feared outcome never happens is told, in effect, to keep repeating until they feel calmer — which (i) can take many repetitions, (ii) makes anxiety the measure of success, and (iii) is the belief ("I must feel calm to be okay") the tool is supposed to loosen. Fix: a step counts as done when it has been completed once with outcome `didnt-happen` or `partly`, or twice with any outcome; suggest the next rung after that, and *offer* a repeat. Rewrite `:119`: *"Tried 2× · the thing you feared didn't happen either time. You can repeat it or move up — anxiety doesn't have to drop for a step to count."* Rewrite `:452`: *"Start with steps that feel uncomfortable but doable. Move up once you've done a step and seen what actually happened — you don't need to feel calm first."*
- **No very easy rungs.** Starter steps run 3–8/10 (`confidence.ts:71-78`). Someone who freezes in meetings may need 1–2/10 rungs first: "Say good morning to someone in the kitchen", "Ask a shop assistant where something is", "Say 'I agree' once in a meeting". Add three.
- **Jumping to the top rung.** Every rung has its own "Plan" button (`Confidence.tsx:484`). That is fine (autonomy), but when the planned step is ≥3 points above the highest completed step, show a one-line hint: *"That's a big jump from your last step. Still want to? A smaller step first often makes this one easier."* No block.
- **Safety-behaviour list** (`confidence.ts:60-68`) is accurate and the "notes hidden" experiment (`TalkSession.tsx:314`) is a genuinely good behavioural experiment. Keep.
- **"It happened" path is one line** (`Confidence.tsx:204`). This is where someone can spiral. Add two optional prompts to `CheckIn` when outcome is `happened`: *"How did you cope?"* and *"What's a slightly smaller version to try next?"*, and link to "Untangle a thought" with the situation pre-filled.
- **Planning a step has no date.** Add "When?" (`Confidence.tsx:314`, page 1 of the new three-page planner) so Today can surface "How did [step] go?" the day after, which is also when post-event processing peaks.
- **The new if-then plan** (`Confidence.tsx:341-358`) is the right addition and is correctly optional. Two notes: the "then" line is shown back at check-in (`:396-400`), good; also offer it as a phrase-bank entry, as the feature-ideas note (D4) suggests, so it is rehearsed rather than only written.
- **The new worry box** (`:361-365`) appears only when anxiety ≥ 7 and is explicitly not saved — both correct. See §6.2 on its "In one study" sentence.

### 4.3 Self-report integrity (findings 1–3)

These matter more than they look, because every Confidence number the app shows is derived from them.

- `ResponseCapture.tsx:104-105`: predicted defaults to 4, observed to 5. Progress then counts `observed > predicted` as "came across better than expected" (`Progress.tsx:139-142`). Default both to the same value (5), and only save `selfView` if at least one slider was moved.
- `Confidence.tsx:530,535`: belief-before 70, belief-after 40. Default `beliefAfter` to `beliefBefore` (the check-in already does this correctly for anxiety: `:385`).
- `TalkSession.tsx:429-430`: when the learner leaves the prediction blank, the app stores `"It would go badly"` at 50% likelihood. The "Did what you worried about happen?" question is then asked about a worry they never stated. Make `prediction` optional in the type, skip the outcome question when it is empty, and exclude such entries from `fearNotHappened`.
- `Confidence.tsx:73-76` pools `kind: "rehearsal"` and `kind: "real-world"` into one "X of Y feared outcomes didn't happen". Rehearsing alone in a room is a much weaker test than speaking in a meeting; mixing them inflates the headline. Show real-world separately ("3 of 4 real-world · 2 of 2 rehearsals").

### 4.4 Self-check (`Confidence.tsx` `SelfCheck`, `confidence.ts:142-153`)
Non-scored, non-diagnostic, previous answers shown, now one question per screen — good design. Copy problems:
- `:672-673` "CBT with a therapist is the recommended treatment for social anxiety, and it helps many people." Two issues: it names a condition, and "recommended" is unattributed (reads as a clinical claim). Rewrite: *"Talking therapies such as CBT are the usual first step for anxiety about speaking and social situations, and many people find them helpful. A GP or doctor can point you to one."*
- `:680` "The brave steps and thought tools here may help" is good. Keep "may".
- Threshold (any single answer ≥ "A lot") is reasonable for a signpost. A clinician will want to review the four questions, as the plan already notes.

### 4.5 Crisis handling (`safety.ts`, `Confidence.tsx:254-264`)
- Tone is right: not alarmist, not dismissive, names a person, says plainly the app can't help. The patterns are broad-but-sane; a false positive just shows resources. Suggested additions to `CRISIS_PATTERNS`: `can'?t go on`, `not worth living`, `don'?t want to be here`, `rather (be )?dead`.
- The app nowhere claims to monitor for crisis (good — MASTER_PLAN §9 forbids it). Keep it that way; don't add "we check your text" copy.
- "Need support now?" is collapsed under a `<details>` on the Confidence home (`:192-195`). It should be a visible row, not an expander, so it's one tap.

### 4.6 Observer review (`ResponseCapture.tsx:208-244`)
The structure (predict → listen as an audience member → re-rate) is the Clark & Wells video-feedback procedure. Two refinements make it work as intended:
- Cognitive preparation is a single slider. Add one free-text line before listening: *"What do you expect to notice? (e.g. 'my voice will shake', 'long pauses')"* and change the listening hint (`:237`) to *"Listen for what an audience member would actually notice — not how it felt from the inside."*
- When observed < predicted (`:266`): "Worth noting what you'd change — then let it go." is good. Consider offering the "It happened" recovery prompts from 4.2.
- The new **"Send to one person for a one-word reaction"** (`:380-410`) is the cheapest possible version of the invited-listener phase and asks exactly the right two things (one word, one clearest moment). Keep. One addition: let the learner record what the person said back (a single line) so it lands in the brave-steps log as real-world evidence.

---

## 5. Guided plan (`plan.ts`, `PlanCard.tsx`)

**Is 4 tasks/week realistic?** Yes for the target user (early-career, phone in hand): one 5-minute Learn, one 5-minute Talk, one real-world step they'd probably attempt anyway, one 2-minute extra. About 15–20 minutes a week. The "brave step" task is the one that will be missed, and that's fine.

**Pressure and guilt:**
- Weeks advance on the calendar (`plan.ts:198-201`), so an inactive user returns to "Week 3 of 4" with an empty bar. The look-back form (`PlanCard.tsx`, `Lookback`) then prints "0 sessions (0 spoken) · 0 brave steps · 0 reviews" and asks "One thing that went well". (The three-part look-back — went well / got in the way / try next week — added in `e1132bc` is a good structure for an *active* week; "got in the way" is even the right question for a missed one, but only if the summary line and "went well" don't come first.) For an anxious user this is a small shame moment at exactly the point they came back. Fixes, in order of effort:
  1. Copy variant when a week has zero activity: *"Week 2 passed without a session — that happens. Nothing is lost; this week's tasks are the same."* and skip the look-back question.
  2. Let the user "Pause plan" / "Shift my week" (set `startedAt` forward by a week) instead of only "End plan" (`:98`).
  3. Or advance weeks on completion (≥2 of 4 tasks) rather than calendar — simpler mental model, no catch-up.
- There are no streaks and no penalties (good). The progress bar and tick list are fine.

**Degrading gracefully:** week-1 "ladder" extra is state-based so it stays ticked; others are window-based so they reset. After week 4, only the week-4 look-back is offered; earlier missed look-backs vanish (`PlanCard.tsx:28-47`). Acceptable.

**After week 4:** "Start a new plan" replays the same four weeks (`PlanCard.tsx:35-40`). Suggest a second cycle definition in `PLAN` (same skills, harder exercises, "challenging" audience default, next ladder rungs) or a "maintenance" mode: one session + one brave step a week, no weekly theme.

**Content detail:** week 3's talk is `persuade` (`plan.ts:176`), which maps to a *stretch* exercise requiring "acknowledge one limitation" (`curriculum.ts:150`). Week 4's `propose-change` is *core*. Swap them so difficulty rises.

**Plan task links:** the "Explain a story" task links to the featured story only (`PlanCard.tsx:56`); if stories failed to load, the task is inert text with no explanation. Fall back to `{ name: "today" }`.

---

## 6. Copy and tone

### 6.1 Inconsistent terms (pick one of each)
| Concept | Variants found | Recommendation |
|---|---|---|
| A real-world speaking attempt | "brave step" (plan, Confidence), "experiment" (README, MASTER_PLAN), "Plan a speaking moment" (`Confidence.tsx:129`), "Real-world attempts" (`Progress.tsx:37`), "Try it for real" / missions (`Progress.tsx:235`) | **"Brave step"** everywhere in the UI; "experiment" only in docs/code. Merge Missions into brave steps (finding 6): the three missions become starter ladder rungs tagged with a skill. |
| Spoken/typed | "Speak / Type" tabs, "Spoken sessions / Written sessions" (`Progress.tsx:25-29`) | "Spoken / Typed sessions" |
| UK/US spelling | "Practise in reviews", "Practise this again later?", "while I practise" vs "Practice it as a talk" (`LearnSession.tsx:353`); "Organise your thoughts" (`plan.ts:175`) vs "Organize supporting ideas" (`curriculum.ts:14`); "Catastrophising", "Summarize" | The codebase is mostly UK; fix `LearnSession.tsx:353` → "Practise it as a talk", `curriculum.ts:14` → "Organise", and `:52` "Summarise" |
| Review timing | "We'll ask you about it again in a few days" (`LearnSession.tsx:311`) | First review is tomorrow (`schedule.ts:104-106`): "We'll ask you about it again tomorrow, then at longer gaps." |

### 6.2 Overstatement / measurement claims
- The tab is called **Confidence** and Progress has a **Confidence** section with averages (`Progress.tsx:104-144`). PILOT_PLAN promises "No claims about confidence, anxiety or intelligence." The numbers are labelled self-reported, which is honest, but the section title implies the app measures confidence. Rename the Progress section "Brave steps and thoughts" and consider the tab "Nerves" or "Brave steps". If "Confidence" stays as the tab name, keep every number under it explicitly "self-reported", as now.
- "Many people find the habits weren't protecting them as much as they felt" (`Confidence.tsx:167`) is a leading conclusion attached to a comparison the same sentence calls "not proof". Cut the second sentence or soften to *"If the dropped-habit numbers aren't worse, that's worth noticing."*
- "It's how you find out what really happens" (`:130`) — fine.
- **Two new "In one study…" sentences (finding 19).** Worry box (`Confidence.tsx:363-364`): "In one study, people who did this before a high-pressure task performed better than those who sat quietly." "I'm excited" tip (`TalkSession.tsx:631-632`): "In one study, speakers who said this before a talk were rated more persuasive than those who tried to calm down." Both are hedged and roughly faithful to Ramirez & Beilock 2011 and Brooks 2014, but they are outcome claims from other people's studies placed in product copy, which MASTER_PLAN §9 lists under "claims we must not make", and the feature-ideas note itself flags Brooks' mixed replication. The techniques are fine to offer; the sentences are not needed to offer them. Rewrite worry box: *"Writing worries down for a couple of minutes beforehand can take some of the charge out of them. This box isn't saved anywhere."* Rewrite excited: *"Nerves and excitement feel almost the same in the body. Some people find it easier to call it excitement than to try to calm down."* If a citation is wanted, put it in a `<details>` with author and year, not in the tip.
- Tagline "Small brave steps, and a calmer way to think about them" (`:81`) — fine, non-clinical.

### 6.3 Specific rewrites
| File:line | Now | Suggested |
|---|---|---|
| `TalkSession.tsx:324` | "Continue" | "Continue to the question" (and a hint under the recorder: "Next: one audience question, then your feedback.") |
| `TalkSession.tsx:444` | "In your next real meeting, try opening with your main point." | Use the exercise's `laterVariation`, prefixed "This week, for real:" |
| `TalkSession.tsx:464` | "Notes covered: 3 of 5" | "Notes you didn't get to" (list only; no ratio) |
| `TalkSession.tsx:237` | "Topic" (persuade) | "The position you'll argue (e.g. 'we should trial four-day weeks')" |
| `TalkSession.tsx:237` | "Where you're introducing yourself" (required, unused) | Either make optional or insert `{topic}` into `mp-introduce.prompt` ("Introduce yourself at {topic} to {audience}…") |
| `Feedback.tsx:39` | "Almost — one thing to try" | Only when `priority` is non-null; otherwise "Not there yet — see the note below". ("Almost" is false for a response far from the goal.) |
| `Confidence.tsx:42` | "Saved. Come back afterwards and tell us how it went." | "Saved. After you've done it, come back here and tell us what actually happened." |
| `PlanCard.tsx` (`Lookback`) | "One thing that went well / got in the way / to try next week" | Keep for active weeks; for a zero-activity week drop the summary line and "went well", keep "got in the way" and "try next week" |
| `Settings.tsx:84` | "I've read how transcription works (unticking shows the explanation again)" | "Show the transcription notice again" as a button, or drop the checkbox and keep the per-recording consent |
| `Progress.tsx:51` | "Goal met (AI-coached attempts)" | "Goal met · AI judgement" with the existing hint |
| `Progress.tsx:235` | "Try it for real (optional)" | Remove after merging into brave steps; until then, "Also counts as a brave step" and make it tick the plan |
| `LearnSession.tsx:230` | "· harder version" | "· next level: {exercise.title}". With `e1132bc` the ladders are now three deep (`org-two-reasons → org-what-so-what → org-stretch-objection`; `ex-concrete-case → ex-twelve → ex-analogy`), and "Explain it to a curious 12-year-old" is a *different* task, not a harder one, so the word "harder" is now wrong as well as vague |
| `Onboarding.tsx:30` | "Short sessions: read something interesting, explain it in your own words, get one specific tip, and try again." | Add one line: "There's also a Talk rehearsal with a simulated audience, and Confidence tools for when speaking makes you nervous." (Otherwise two of four tabs are a surprise.) |
| `Onboarding.tsx:7-12` | "Your main goal" radio | Either use it (e.g. default scenario, first ladder suggestions, plan week order) or remove it. Asking and ignoring is worse than not asking. |
| `observations.ts:23` | "Opening sentence: N words" | Remove, or show only when > 30 words with basis "Long openings bury the point." |

### 6.4 Jargon check
"Assisted recall", "fidelity", "modality" never appear in the UI — good. "Brave steps ladder", "Untangle a thought", "Look back" are plain. "Simulated audience" is clear and honestly labelled. "Observer" (`ResponseCapture.tsx:211`) is slightly clinical; "Listen back as an audience member" is already used elsewhere — use that.

---

## 7. Flow friction

### 7.1 Taps from Today to first feedback
**Learn, typed:** Start (1) → "I'm ready — hide the briefing" (2) → Type tab (3) → type → "Get feedback" (4). **4 taps.** Good.
**Learn, spoken, Deepgram:** Start (1) → ready (2) → mic (3) → Finish (4) → "I understand — transcribe" (5, first time) → check transcript → "Get feedback" (6). **5–6 taps.** Good.
**Talk, spoken, Deepgram, from the tab:** "Rehearse a talk" (1) → scenario (2) → type topic → Continue (3) → "I'm ready to present" (4) → mic (5) → Finish (6) → observer: Listen back (7) → Done listening (8) → Save (9) → Transcribe (10) → "Continue" (11) → question loads → mic (12) → Finish (13) → Transcribe (14) → "Get feedback" (15). **15 taps; 11 if observer and question skipped.** Feedback on the *talk* does not appear until after the question is answered or skipped.

Recommendations:
- Give talk feedback immediately after the talk (one call), then ask the question, then evaluate the answer with `fu-answer-directly` the way Learn already does. The combined-call design saves one API call but delays the payoff by 4–6 taps and makes the feedback screen do double duty.
- Move observer review *after* feedback (optional "Listen back" on the done screen) rather than between recording and transcription. It currently sits in the critical path of every spoken talk.
- Allow "Skip the question" while loading (`TalkSession.tsx:337-356`). An anxious user staring at "The audience is thinking…" with no exit is a small but real friction.
- Pre-fill `topic` when the scenario is `introduce` (it isn't needed) so the Continue button isn't disabled.

### 7.2 Dead ends and orientation
- Learn and Talk done screens are good endings: a tick, what you did, the saved item, WrapUp, and two clear buttons. **Sessions do have a satisfying ending.**
- Confidence sub-screens return to home with a flash message — fine. But after saving a brave-step plan there is nothing to do until the event; the user must remember to come back. Date field + Today surfacing (finding 18) closes this.
- Review tab is reachable from Today (pill) and Progress; the badge is on Today. OK.
- Phrase bank is two taps deep (Progress → Phrase bank). Fine.
- Missions on Progress are a dead-end feature: logging one changes nothing elsewhere.

### 7.3 Steps that could merge
- Talk setup: "Length" could default from `prefs.sessionMinutes` and move under "More options".
- Learn "save" step could default-select and show the choice on the done screen with "Change" — saves one screen for the 80% case. (Low priority; the explicit step also serves as a cool-down.)

---

## 8. Missing pieces that matter most for real benefit

Ordered by expected effect on the person, not by feature size.

1. **One real-world system, connected to coaching.** Merge Missions into brave steps; after any session, offer "Plan to use this for real" which creates a brave step pre-filled with the skill's `laterVariation` and a date. This is the transfer link that currently exists only inside spaced reviews. (`Progress.tsx:230-305`, `Confidence.tsx:281-330`, `LearnSession.tsx:336-357`.)
2. **Fix the self-report defaults** (findings 1–3). Without this, every Confidence number is partly fiction, and the pilot's "fears that didn't happen" signal is untrustworthy.
3. **Expectancy-based ladder progression** (finding 4), with 1–2/10 rungs and an "it went badly" recovery path.
4. **Implementation intention at session end.** Brave steps now have an if-then line (`e1132bc`), which covers the *event*. What is still missing is the *habit*: one line on both done screens: *"When's your next session? [Tomorrow morning / Tomorrow evening / Pick a day]"* stored locally and shown on Today. No notifications needed yet.
5. **Progression for Talk and after week 4** (§2.2, §5).
6. **Feedback usefulness rating:** now exists (`Feedback.tsx:91-101`). Two refinements: on "Not really", ask one tap more ("Too vague / Wrong about what I said / Not about the skill / Other"), because that is the data the pilot needs; and include the rating in the eval runner's output format so human rubric scores can be compared with learner ratings.
7. **Prompt guardrails** (§3 items 1–5). Cheap; each closes a known LLM failure mode.
8. **A weekly one-item self-report** ("How did speaking up go this week?", 1–5, self-reported) shown on the plan look-back, kept separate from coaching, with the look-back text. Not a validated measure and must not be presented as one; it gives the person a trend to look at and the pilot something to correlate with usage.
9. **Pre-event quick prep.** With `e1132bc`, `PlanStep` (page 3) now holds most of this: habit to drop, if-then, worry box, outward-focus cue. What's missing is the entry point and the thought: a "Something coming up?" row on Confidence home that opens `PlanStep` with a date and, if anxiety ≥ 7, offers "Untangle the thought" inline rather than as a separate tool.
10. **Clinical review** of the Confidence copy and the four self-check questions before any external user, as MASTER_PLAN §9 already says. The rewrites in §4.4 and §6.2 should go in that review.

---

## 9. What is good and should be protected

- Quote verification with visible removal count (`claude.ts:232-259`, `Feedback.tsx:113`).
- No scores, no streaks, no filler-word counters; quiet mode (`Settings.tsx`).
- Demo mode that refuses to pretend (`demo.ts`, `Feedback.tsx:33-35`).
- Assisted-recall flag and the "marked assisted" summary text (`LearnSession.tsx:243`).
- Typed and spoken tracked separately; measured observations state their basis and limits (`observations.ts`).
- "No need to replay it" wrap-up anchored on a real strength (`Feedback.tsx:176-186`).
- The notes-hidden safety-behaviour experiment (`TalkSession.tsx:314`).
- Crisis copy tone and the "not a crisis service" line in Settings.
- Self-check that is explicitly unscored and shows last answers.
- FSRS with a daily cap, "recall before reveal", and source-changed flags on news items.
- The eval rubric mirroring the prompt rules.
- From `e1132bc` and the working tree: the optional if-then plan; the unsaved worry box gated on high anxiety; the one-tap "send to one person" share; the distanced self-talk hint on "what would you tell a friend"; the 28-day activity dots that show practised days without counting misses or streaks; pause/resume on the recorder (freezers need this).

---

## Appendix: quick test ideas for the fixes above

- `summarize()`/progression: a session with attempt(goalMet) + retry(goalMet) must not advance the level; two sessions with one met attempt each must.
- `selfView`: untouched sliders must not produce a `selfView`.
- `Reframe`: default `beliefAfter === beliefBefore` before interaction.
- Rehearsal experiment with empty prediction: `prediction` undefined, excluded from `fearNotHappened`.
- `suggestNextStep`: a step completed with `outcome: "didnt-happen"` and `anxietyAfter: 8` counts as done.
- Plan: zero-activity week renders the "that happens" variant and no look-back textarea.
