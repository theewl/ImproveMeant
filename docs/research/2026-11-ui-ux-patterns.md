# UI/UX patterns from adjacent apps — notes for Clearline (Nov 2026)

Time-boxed desk research, 2026-11-02. Method: WebSearch (standard) across the named apps plus platform guidance; WebFetch was blocked for most hosts in this session (m3.material.io, blog.duolingo.com, help.finchcare.com, screensdesign.com, www.w3.org unreachable; developer.apple.com returned title-only). Unless marked "fetched", every claim below is **search-indexed, not fetched** — i.e. taken from search-result snippets of the cited page. Verify against the live app before copying numbers. All URLs accessed 2026-11-02.

Clearline baseline (for contrast): warm off-white, teal accent, serif headings, 4-tab bottom bar, pill buttons, cards, big round record button, progress bar in sessions.

---

## 1. Calm / meditation / mental-health apps

### Headspace
- **Onboarding asks 3–4 goal questions, then a one-screen recap + immediate CTA to start.** Sequence: experience level → session length → reasons for joining → preferred time → recap → "begin now". Users were motivated by articulating a goal. https://goodux.appcues.com/blog/headspaces-mindful-onboarding-sequence ; https://medium.com/hellotegra/headspaces-onboarding-sequence-ux-case-study-9b7fef3786f0 (search-indexed; accessed 2026-11-02)
- **Avoid:** a 2026 Pratt critique calls the current onboarding "long, repetitive, and misaligned with the intended emotional tone"; a case study reports a 38% drop-off across onboarding. Keep Clearline's first-run to ≤3 screens. https://ixd.prattsi.org/2026/02/design-critique-headspace (search-indexed; accessed 2026-11-02)
- **No mandatory mood check-in in Headspace's core loop** — critics ask for an *optional* post-session rating. Pattern: make check-ins optional and post-task, never a gate. https://ixd.prattsi.org/2020/09/design-critique-headspace-app/ (search-indexed; accessed 2026-11-02)

### Calm
- **Home = one hero "+ meditate" action + a short curated "today" strip** (Daily Calm, Daily J prompt, Daily Move). Streak count is *not* in primary navigation. https://ixd.prattsi.org/2018/01/design-critique-calm-ios-app/ ; https://mechanics-playbook-next.pages.dev/case-studies/calm/ (search-indexed; accessed 2026-11-02)
- **Reflection prompt appears only after the Daily Calm finishes** — a tiny, optional journaling step at session end. https://mechanics-playbook-next.pages.dev/case-studies/calm/ (search-indexed; accessed 2026-11-02)
- **Avoid:** premium-gated "Daily Calm" button at top of free home page reads as a paywall interrupt. https://hockadayfourcast.org/19069/community/artstyle/keep-calm-and-delete-calm/ (search-indexed; accessed 2026-11-02)
- **Avoid:** "copying gradients, nature imagery and quiet language without a strong content route produces mood but not activation" — calm aesthetics need a clear next action. https://screensdesign.com/articles/calm-onboarding-design/ (search-indexed; accessed 2026-11-02)

### Finch
- **Streak = "opened the app today"; missing a day doesn't punish the pet.** Help center: "Your streak is counted each day you open the Finch app — just checking in is enough." Reviewers: a missed day "feels like a pause", not a loss. https://help.finchcare.com/hc/en-us/articles/37780736136205-Understanding-Streaks ; https://makeheadway.com/blog/finch-app-review/ (search-indexed; accessed 2026-11-02)
- **User sets their own goals rather than a preset program**; no streak stats or calendar heatmap. https://www.whistleout.com/CellPhones/Apps/finch-self-care-app-review ; https://habitbox.app/blog/finch-app-review (search-indexed; accessed 2026-11-02)
- **Avoid:** drift toward cosmetic shops crowding out the core tracking; reviewers note gamification creep. https://yourstory.com/2022/06/app-review-self-care-pet-finch-gamifies-mental-wellbeing (search-indexed; accessed 2026-11-02)

### How We Feel
- **Progressive narrowing check-in: 2-axis quadrant (energy × pleasantness) → tap a quadrant → pick one word from that quadrant's colored grid.** Avoids showing a long emotion list at once. Onboarding is learn-by-doing: the first task *is* a check-in. https://screensdesign.com/showcase/how-we-feel ; https://medicine.yale.edu/news-article/the-how-we-feel-app-helping-emotions-work-for-us-not-against-us/ (search-indexed; accessed 2026-11-02)
- **Avoid autopilot:** a long-term user reports always landing in the same quadrant; pairing the word with one written sentence restored precision. Pattern for Clearline: a 1-line "why" after any slider. https://problem2product.substack.com/p/does-how-we-feel-solve-a-problem (search-indexed; accessed 2026-11-02)
- **Avoid hidden affordances:** users didn't discover search-for-emotion or the "+" for a second emotion. Keep controls visible. https://justuseapp.com/en/app/1562706384/how-we-feel/reviews (search-indexed; accessed 2026-11-02)

### Bearable
- **Design goal stated by the developer: entry "should not feel like a boring medical form or questionnaire"** — mood score + emotions + short note, with customizable factors. Reviewers rate UX 4–4.5/5 but some call it "bland". https://www.choosingtherapy.com/bearable-app-review/ ; https://bearable.app/mood-tracker-app-journal/ (search-indexed; accessed 2026-11-02)
- Pattern: brief notes field (not full journaling) attached to every log. https://healthify.nz/apps/b/bearable-symptom-tracker-app (search-indexed; accessed 2026-11-02)

### Reflectly
- **Mood slider with large icons; open-ended journaling broken into small steps; friendly microcopy + light animation as continuous encouragement.** Large rounded tappable buttons. https://screensdesign.com/showcase/reflectly-journal-ai-diary ; https://goodux.appcues.com/blog/reflectlys-easygoing-daily-journaling ; https://mobilesyrup.com/2019/04/07/reflectly-journaling-app-review/ (search-indexed; accessed 2026-11-02)
- **Avoid:** after the first check-in it stacks congratulation → quote → reminder-setup; reviewers call this awkward. One post-task screen, not three. https://screensdesign.com/showcase/reflectly-journal-ai-diary (search-indexed; accessed 2026-11-02)

### Stoic
- **Step-by-step guided exercises (coaching line + space to write), near-monochrome black/white theme praised as "close to perfect".** https://mobilesyrup.com/2019/06/09/stoic-self-reflection-journaling-app-review/ ; https://apps.apple.com/US/app/id1312926037 (search-indexed; accessed 2026-11-02)
- **Avoid:** home "greeted with a lot of choices… overwhelming". https://apps.apple.com/US/app/id1312926037 (search-indexed; accessed 2026-11-02)

## 2. Habit / learning apps

### Duolingo
- **Lesson screen: thin progress bar at top, one exercise per screen, instant per-answer feedback banner.** Completion: mascot + "Lesson complete! +10 XP, 25 XP today" with XP/accuracy/speed tiles and a single primary button. https://lazyweb.com/canvas/flows/duolingo/start-lesson ; https://screensdesign.com/apps/duolingo-language-lessons/ ; https://uxplanet.org/ux-and-gamification-in-duolingo-40d55ee09359 (search-indexed; accessed 2026-11-02)
- **Streak rule simplified to "one lesson keeps it"**; streak animation is bigger only on milestone days (7, 30). https://blog.duolingo.com/how-duolingo-streak-builds-habit ; https://desirabilitylab.com/backfill/backfill-2025-353-duolingo-streak-system (search-indexed; accessed 2026-11-02)
- **Avoid:** two obligatory taps to exit a finished lesson (reviewer: "combine XP and bonuses on one screen"); loss-aversion streaks drive "shortest lesson possible just to protect the streak" and were widely called hostile. https://uxplanet.org/ux-and-gamification-in-duolingo-40d55ee09359 ; https://jiwonvyoo.github.io/portfolio/case/duolingo/duo.html ; https://www.productcoalition.com/p/streaks-nudges-and-the-behavioral (search-indexed; accessed 2026-11-02)

### Elevate
- **Home = "recommended daily regimen" card on top, alternatives below; 3–5 short games auto-chain, ~10–15 min total.** Critique: no clear cue to start the first game — the hero needs an explicit Start button. https://ixd.prattsi.org/2023/02/design-critique-elevate-ios-app/ ; https://apps.apple.com/us/app/id875063456 (search-indexed; accessed 2026-11-02)

### Brilliant
- No usable design-specific sources surfaced in this time box (two searches). Not covered.

### AnkiMobile
- **Review screen: card content only, answer buttons along the bottom, native iOS components; "minimalist design helps me stay focused… no distracting elements."** https://www.g2.com/products/Anki/reviews ; https://forums.ankiweb.net/t/suggestion-improve-ankimobile-s-interface-design/67315 (search-indexed; accessed 2026-11-02)
- **Avoid:** dated look, steep learning curve, no tutorial. https://marlvel.ai/intel-report/education/ankimobile-flashcards (search-indexed; accessed 2026-11-02)

## 3. Speaking / voice apps
- **iOS Voice Memos: single central record button (tap again to stop), live waveform as the only visual, recordings list below; pause/resume hidden behind a swipe-up.** iOS 7 redesign deliberately "focuses on your vocal waveforms rather than skeuomorphic microphones." https://help.apple.com/ipod-touch/7/en.lproj/iph96b20c4a.html ; https://www.macworld.com/article/221950/get-to-know-ios-7-voice-memos.html (search-indexed; accessed 2026-11-02). Avoid: hidden pause confused users; keep Stop/Pause visible.
- **Speeko: playback with annotated feedback showing exactly where fillers occurred; course-style daily exercises.** https://yoodli.ai/blog/orai-vs-speeko-what-to-know ; https://speakshark.com/blog/yoodli-vs-orai-10-english-apps-compared (search-indexed; accessed 2026-11-02)
- **Orai (avoid):** users found feedback graphs "clunky or difficult to interpret" — too many metrics at once. https://www.stork.ai/en/orai (search-indexed; accessed 2026-11-02)
- **Yoodli:** web-first; praised for "intuitive interface"; its live-feedback widget is small and unobtrusive during a call. https://support.yoodli.ai/en/articles/9550461-yoodli-overview ; https://www.techraisal.com/blog/yoodli-ai-review-a-practical-look (search-indexed; accessed 2026-11-02)

## 4. Journaling apps
- **Apple Journal: "+" opens a full-screen sheet of suggestions + reflection prompts (open questions) + "start empty" — encourages multiple short entries per day; deliberately simple.** https://www.macstories.net/reviews/apples-journal-app-journaling-for-all/ ; https://www.guidingtech.com/apple-journal-vs-day-one/ (search-indexed; accessed 2026-11-02)
- **Day One: daily prompt lives in a swipe-open side menu, with templates; reviewers call the UI "busy but functional". Avoid:** most features behind subscription. https://www.androidauthority.com/apple-journal-vs-journey-day-one-3380137 ; https://dayoneapp.com/?p=28941 (search-indexed; accessed 2026-11-02)

## 5. Platform guidance (HIG / Material 3 / WCAG)
- **Tab bars:** Apple HIG and M3 both say 3–5 top-level destinations; M3: never fewer than 3 or more than 5; iOS 26 tab bars float (Liquid Glass) and can minimize on scroll. Clearline's 4 tabs are fine. https://developer.apple.com/design/human-interface-guidelines/tab-bars (fetch returned title only) ; https://material.io/components/bottom-navigation ; https://developer.android.com/develop/ui/compose/components/navigation-bar (search-indexed; accessed 2026-11-02)
- **Touch targets:** Apple 44×44 pt minimum; Material 48×48 dp; WCAG 2.2 SC 2.5.8 (AA) 24×24 CSS px floor, SC 2.5.5 (AAA) 44×44. Use 44 px CSS as the floor for all Clearline controls. https://www.disabilityworld.org/toolkit/standards/wcag/2-5-8-target-size-minimum/ ; https://tetralogical.com/blog/2022/12/20/foundations-target-size/ ; https://chromium.googlesource.com/external/github.com/material-components/material-components-ios/+/stable/components/BottomNavigation/ (search-indexed; accessed 2026-11-02)
- **Motion:** HIG — motion must be purposeful; honor Reduce Motion by replacing zoom/slide/parallax with crossfade. In CSS: `@media (prefers-reduced-motion: reduce)`. Community rule of thumb ≤300 ms. https://developer.apple.com/design/human-interface-guidelines/motion (fetch returned title only) ; https://skills.cat/skills/ehmo/platform-design-skills/ios-design-guidelines (search-indexed; accessed 2026-11-02)
- **Dynamic Type:** text may scale ~200%; layouts must reflow, not clip. Web equivalent: size everything in `rem`, no fixed-height text containers. https://smithery.ai/skills/ehmo/ios-design-guidelines (search-indexed; accessed 2026-11-02)

## 6. Accessibility for mental-health apps
- **Reading level ~grade 8**; short sentences, no idioms; studies found almost all mental-health apps exceed this and 99% contain user-identified jargon. https://www.albertahealthservices.ca/assets/info/amh/if-amh-ke-accessibility-considerations-amh-communication.pdf ; https://www.frontiersin.org/articles/10.3389/fdgth.2021.742196/full ; https://doaj.org/article/39cc0ecd6cfa419fb9306460791343c4 (search-indexed; accessed 2026-11-02)
- **Never use color alone** (mood calendars fail for color-blind users); 4.5:1 contrast (WCAG AA). No authoritative source found specifically on "alarming red" — treat as a tone choice: reserve red for destructive actions only. https://themomentum.ai/blog/accessibility-in-healthtech-how-to-design-apps-that-speak-to-everyone (search-indexed; accessed 2026-11-02)
- Cognitive-accessibility guide: one task per screen, predictable navigation, no time pressure. https://hackernoon.com/a-developers-guide-to-accessibility-for-mental-health-and-cognitive-disabilities (search-indexed; accessed 2026-11-02)

## 7. 2025–26 trends that are substantive
- **"Calm tech" as a counter-trend to dopamine design**: quiet, minimal, breathing room. https://contra.com/community/lTkdwSqw-calm-tech-2026-didnt-just (search-indexed; accessed 2026-11-02)
- **Check-ins under 30 seconds; low friction beats features for long-term use.** https://vp0.com/blogs/wellness-app-template.md (search-indexed; accessed 2026-11-02)
- **Soft palettes, breathing-room compositions, real practice UI in screenshots convert.** https://appscreenshotstudio.com/templates/category/wellness (search-indexed; accessed 2026-11-02)
- **Designers consciously remove elements that invoke stress, pressure, or distraction.** https://usabilitygeek.com/?p=10380 (search-indexed; accessed 2026-11-02)
- Fad to ignore: glass-over-neon-gradient "orbs" style. https://vp0.com/blogs/aesthetic-app-design-examples.md (search-indexed; accessed 2026-11-02)

---

## Top 12 concrete UI changes for Clearline (ordered by impact)

1. **Home screen → one hero card + short list.** `HomeScreen`: a single "Today's step" card (title, 1-line why, ~time, big Start button) with 2–3 secondary rows below (next review, brave step, plan week). Remove any other hero. (Calm, Elevate.)
2. **Recording screen = waveform + one big control, nothing else.** `RecordScreen`: live amplitude bars, elapsed timer, round Stop button in the exact spot Record was; a visible (not hidden) Pause pill beside it; hide the tab bar and progress bar while recording. (Voice Memos; avoid Voice Memos' hidden pause.)
3. **End-of-session summary = one screen, one stat, one coaching point, one next action.** `SessionSummary`: "You explained it in 48s" + the single coaching point + primary "Retry" / secondary "Done". No stacked congratulations → quote → reminder. (Duolingo critique, Reflectly critique.)
4. **Feedback timeline strip.** On replay, a thin bar under the waveform with 1–3 tappable markers where the ramble/freeze/filler happened; tapping seeks. Show one marker type at a time. (Speeko; Orai's "too many graphs" as the anti-pattern.)
5. **Check-ins: one question per screen, large tappable slider with 3–5 labelled stops, optional 1-line "why" field.** `CheckIn` component with `<input type=range>` styled 56px tall, haptic-style tick labels; cap at 30 s. (Reflectly, How We Feel, Bearable.)
6. **Progress as a dot calendar, not a streak counter.** `ProgressDots`: 7×N grid of filled/empty dots in teal; copy "4 sessions this week"; no fire icon, no "don't break it". Credit any open+activity as a day. (Finch, Calm's hidden streak.)
7. **Celebration budget: one subtle motion per session end.** A single 300 ms scale-in of the stat, nothing looping; `@media (prefers-reduced-motion: reduce)` → opacity fade only. Milestone (week complete) gets a larger but still single animation. (Duolingo milestone logic, HIG motion.)
8. **44 px minimum hit areas everywhere; tab bar 56–64 px tall with icon + 1-word label.** Audit pill buttons, list rows, slider thumb, record button (≥72 px). (HIG/Material/WCAG.)
9. **Type scale: serif display 28–32 px for screen titles, 17–18 px body, 1.5 line-height, `rem` units, max 60ch line length; everything reflows at 200% zoom.** (HIG Dynamic Type; calm-tech trend.)
10. **Micro-copy pass to grade-8 reading level and no jargon.** Replace "cognitive restructuring" → "reframe the thought", "exposure" → "brave step"; one verb per button; coaching point ≤ 20 words. (AHS plain-language, Frontiers study.)
11. **Color discipline: teal = action/progress only; amber for "try again" states; red only for destructive (delete recording). Never encode a result by color alone — always pair with a word or icon.** (Healthtech a11y.)
12. **Briefing → explain flow as a stepper with a thin top progress bar and one card per step; "Skip" always visible, no timers on reading.** `SessionStepper` with steps Read → Explain → Coaching → Retry; back is allowed. (Duolingo lesson chrome, Stoic guided exercises, cognitive-a11y "no time pressure".)
