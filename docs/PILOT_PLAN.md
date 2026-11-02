# Pilot plan

This is a practical companion to `MASTER_PLAN.md` §6–7. Nothing here is executed without explicit approval. That includes outreach, ads and purchases.

## Stage 1: Interviews (about 15 people, 30 minutes each)

**Who:** people in their first five years of work who say they ramble, lose their thread or struggle to explain things. Recruit from varied fields, and avoid close friends.

**Guide.** Ask about past behaviour, not opinions about the product.
1. "Tell me about the last time you had to explain something at work and it didn't go how you wanted." Probe for:
   - When was it?
   - Who was there?
   - What happened next?
2. "How often does that happen? What did it cost you?"
3. "What have you tried?" Probe for Toastmasters, courses, YouTube, AI chat, a coach, or nothing. "Why did you stop?"
4. "Is there a meeting or presentation coming up in the next two weeks?" If yes, move to the live test below.

**Live test (10 minutes):**
- The participant uses the app on their own phone with one real situation, either a Talk scenario or a story they pick.
- Observe without helping.
- Debrief:
  - Was the feedback specific?
  - Would you change anything you'd say?
  - Would you use this before your meeting?

**Record:**
- quotes about the problem, in their own words
- frequency
- current spend in money and time
- usability blockers
- whether they asked to keep using it

**Decision rule:**
- **Proceed:** at least 8 of the 15 describe a specific recent incident with felt cost, AND at least 5 ask to keep using it.
- **Otherwise:** revisit the audience or the outcome.

## Stage 2: Paid 4-week guided pilot (target: 10 paying participants, which is an experiment milestone)

**The offer:** $39 for 4 weeks, as a hypothesis. Describe exactly what exists today:
- AI coaching on structure, not voice analysis
- a curated and live library
- a weekly check-in
- a human-reviewed before/after recording

No claims about confidence, anxiety or intelligence.

**Protocol:**
- **Week 0:**
  - Consent.
  - A baseline recording on an *unfamiliar* prompt, set A.
  - Self-reported confidence (1–5), kept separate.
- **Weeks 1–4:**
  - Voluntary use. No streak pressure.
  - One optional weekly 10-minute check-in.
  - Missions logged in the app.
- **Week 4:**
  - A post recording on comparable unfamiliar prompts, set B. The two prompt sets are counterbalanced.
  - Confidence again.
  - A renewal offer.
- **Week 8:** a delayed follow-up recording, set C, and a short survey.

**Measure:**

| Area | What we look at |
|---|---|
| Voluntary use | Sessions per week, and the share of days with any session |
| Completion | Sessions finished out of sessions started; reviews completed |
| Usefulness | A per-feedback rating; coaching rubric spot-checks by a reviewer |
| Real-world transfer | Missions logged; self-reported situations |
| Cost | Actual tokens and minutes per participant, from `GET /api/usage`, valued at unsubsidised prices |
| Willingness to renew | Stated intent and actual renewal at full price |

**Blind review:**
- Two reviewers rate the recordings without knowing whether each one came before or after the pilot.
- They rate clarity of the main point, organisation, and whether a listener could restate the point.
- A third person listens once and writes down the main point; we compare it with the speaker's stated intent.

**Honest reporting:**
- Report every enrolled participant, including dropouts and non-users.
- Don't present a small pilot as proof of effectiveness.
- To compare against ordinary practice, run a later study with a control group doing plain record-and-playback for matched time.

## Stage 3: Decide

| Outcome | Next step |
|---|---|
| Renewals ≥ 40% and feedback rated useful | Build accounts and sync, then phase 3 (invited partner) |
| People use it but won't pay | Test the guided-programme format, B2B (team leads / L&D), or a lower price |
| Low voluntary use | Revisit the trigger. For example, "rehearse before your meeting" rather than daily content |
