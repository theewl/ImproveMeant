import type { Interest } from "./types";
import { localDayKey } from "./dates";

// Vlogging-first content: niches, a reviewed prompt bank, hook patterns and take
// structures. Built from what successful creators and speakers do (sources in
// docs/MASTER_PLAN.md §12): one idea per take (Anderson's throughline), hook
// before hello (YouTube, MrBeast), talk to one person (Abdaal), setup → turn →
// payoff (Neistat) and what is → what could be (Duarte), imperfection as content
// (Chamberlain), specific over impressive (food and travel creators), explain
// simply without talking down (Brownlee), reps and watch-back.

export type Niche = "daily" | "food" | "travel" | "opinions" | "stories" | "tech" | "fitness" | "money" | "learning" | "creative";

export const NICHES: { id: Niche; label: string; interest: Interest }[] = [
  { id: "daily", label: "Daily life", interest: "culture" },
  { id: "food", label: "Food & cooking", interest: "culture" },
  { id: "travel", label: "Travel & places", interest: "environment" },
  { id: "opinions", label: "Opinions & hot takes", interest: "culture" },
  { id: "stories", label: "Stories from my life", interest: "culture" },
  { id: "tech", label: "Tech & gear", interest: "technology" },
  { id: "fitness", label: "Fitness & health", interest: "health" },
  { id: "money", label: "Money & work", interest: "business" },
  { id: "learning", label: "Explaining things I learn", interest: "science" },
  { id: "creative", label: "Hobbies & making things", interest: "culture" },
];

/** Interests for the news feed, derived from niches (deduplicated, max three). */
export function interestsForNiches(niches: Niche[]): Interest[] {
  const out: Interest[] = [];
  for (const n of niches) {
    const i = NICHES.find((x) => x.id === n)?.interest;
    if (i && !out.includes(i)) out.push(i);
  }
  return out.slice(0, 3);
}

export type HookPatternId = "question" | "claim" | "promise" | "mid-action" | "contrast";

export const HOOK_PATTERNS: { id: HookPatternId; name: string; example: string; why: string }[] = [
  { id: "question", name: "A question they've asked themselves", example: "Why does every trip start with me forgetting something?", why: "A viewer who has wondered the same thing stays to hear the answer." },
  { id: "claim", name: "A bold, specific claim", example: "The best meal I had in Tokyo cost four dollars.", why: "Specific and slightly surprising beats polite and vague." },
  { id: "promise", name: "What they'll get", example: "By the end of this you'll know which of these three I'd buy.", why: "A clear payoff gives the viewer a reason to wait for it." },
  { id: "mid-action", name: "Start in the middle", example: "So the key just snapped in the lock.", why: "Dropping into the moment skips the preamble viewers scroll past." },
  { id: "contrast", name: "What is, then what could be", example: "Right now my mornings are chaos. Here's the version I'm trying.", why: "Duarte's pattern: the gap between now and better pulls people forward." },
];

export type StructureId = "story" | "contrast" | "point-reason-example" | "list-of-three" | "sensory";

export const STRUCTURES: { id: StructureId; name: string; beats: string[]; from: string }[] = [
  { id: "story", name: "Setup, turn, payoff", beats: ["Where you were and what you wanted", "What went wrong or surprised you", "What happened, and what you make of it"], from: "How Casey Neistat shapes a daily vlog." },
  { id: "contrast", name: "What is, what could be", beats: ["How it is now (one concrete detail)", "How it could be", "The first step you're taking"], from: "Nancy Duarte's pattern from Jobs and King." },
  { id: "point-reason-example", name: "Point, reason, example", beats: ["Your opinion in one sentence", "The reason", "One thing that happened to you"], from: "How a point of view reads as personality." },
  { id: "list-of-three", name: "Three things", beats: ["Say there are three", "One, two, three, each with a detail", "The one you'd pick"], from: "Explainers that are easy to follow." },
  { id: "sensory", name: "Three senses and a verdict", beats: ["What it looked or sounded like", "Texture, smell, temperature, the first bite", "Order it, skip it, or how to do it"], from: "How food and travel creators replace 'amazing'." },
];

export type PromptKind = "quick" | "story" | "opinion" | "explainer" | "sensory" | "hook";

export interface VlogPrompt {
  id: string;
  niche: Niche;
  kind: PromptKind;
  /** Written to one viewer. May contain {name}. */
  text: string;
  seconds: number;
  hook: HookPatternId;
  structure: StructureId;
}

/** The camera drill (and its definition of success) a prompt kind is evaluated against. */
export const PROMPT_DRILL: Record<PromptKind, string> = {
  quick: "cam-one-person",
  story: "cam-story",
  opinion: "cam-opinion",
  explainer: "cam-unscripted",
  sensory: "cam-describe-food",
  hook: "cam-hook",
};

const P = (id: string, niche: Niche, kind: PromptKind, text: string, seconds: number, hook: HookPatternId, structure: StructureId): VlogPrompt => ({ id, niche, kind, text, seconds, hook, structure });

export const PROMPTS: VlogPrompt[] = [
  // Daily life
  P("d1", "daily", "story", "Tell {name} the one thing that didn't go to plan today, starting from the moment it went wrong.", 60, "mid-action", "story"),
  P("d2", "daily", "quick", "Give {name} a 30-second tour of where you are right now, with three details they could picture.", 30, "mid-action", "sensory"),
  P("d3", "daily", "contrast" as PromptKind, "Tell {name} what your mornings are like right now and the version you're trying to build.", 60, "contrast", "contrast"),
  P("d4", "daily", "opinion", "What's one small thing you've stopped doing that made life better? Tell {name} why.", 60, "claim", "point-reason-example"),
  P("d5", "daily", "story", "Tell {name} about a conversation this week that stuck with you, and what you'd say now.", 60, "question", "story"),
  P("d6", "daily", "hook", "Open a 'day in my life' video for {name}. Hook first; no greeting.", 40, "promise", "story"),
  P("d7", "daily", "explainer", "Explain to {name} how you plan your week, in three steps, and which step you usually skip.", 90, "promise", "list-of-three"),
  P("d8", "daily", "quick", "Tell {name} what you're looking forward to this week and what you're dreading. Be specific.", 30, "claim", "point-reason-example"),
  // Food
  P("f1", "food", "sensory", "Describe the last thing you ate to {name}: texture, temperature, smell, the first bite, and whether to order it.", 45, "claim", "sensory"),
  P("f2", "food", "opinion", "Tell {name} the most overrated food where you live, with one reason and one meal that proves it.", 60, "claim", "point-reason-example"),
  P("f3", "food", "explainer", "Teach {name} one thing you cook well, in three steps, including the step people get wrong.", 90, "promise", "list-of-three"),
  P("f4", "food", "story", "Tell {name} about a meal that went wrong (burned, late, mystery ingredient) and how it ended.", 60, "mid-action", "story"),
  P("f5", "food", "sensory", "Walk {name} through your coffee or tea this morning as if they'd never had one: smell, sound, heat, taste.", 45, "question", "sensory"),
  P("f6", "food", "hook", "Open a video about a place you ate at recently. First line: what {name} needs to know before going.", 40, "claim", "sensory"),
  P("f7", "food", "opinion", "Tell {name} the one kitchen tool you'd keep if you could only keep one, and the moment it earned it.", 60, "claim", "point-reason-example"),
  // Travel
  P("t1", "travel", "sensory", "Describe the last new place you visited to {name}: a sound, a smell, something you touched, and what surprised you.", 60, "mid-action", "sensory"),
  P("t2", "travel", "story", "Tell {name} about a time you got lost, or something broke on a trip, starting right at the problem.", 60, "mid-action", "story"),
  P("t3", "travel", "opinion", "Where would you tell {name} not to bother going, and why? One honest reason.", 60, "claim", "point-reason-example"),
  P("t4", "travel", "explainer", "Give {name} your three rules for packing, with the one you learned the hard way.", 60, "promise", "list-of-three"),
  P("t5", "travel", "hook", "Open a video about your neighbourhood as if {name} were visiting tomorrow. Hook first.", 40, "question", "sensory"),
  P("t6", "travel", "contrast" as PromptKind, "Tell {name} how you travel now versus how you'd like to. One concrete detail each.", 60, "contrast", "contrast"),
  // Opinions
  P("o1", "opinions", "opinion", "Give {name} a hot take you actually hold, one reason, and one thing that happened to you that proves it.", 60, "claim", "point-reason-example"),
  P("o2", "opinions", "opinion", "What's something everyone says you should do that you've stopped doing? Tell {name} why.", 60, "claim", "point-reason-example"),
  P("o3", "opinions", "opinion", "Tell {name} about an opinion you changed your mind on this year, and what changed it.", 90, "contrast", "contrast"),
  P("o4", "opinions", "hook", "Open a reaction video to something in the news today for {name}: what it is in one line, and your first honest reaction.", 40, "claim", "point-reason-example"),
  P("o5", "opinions", "opinion", "Pick something small that annoys you (an app, a habit, a word) and make the case to {name} in a minute.", 60, "question", "point-reason-example"),
  P("o6", "opinions", "explainer", "Steelman an opinion you disagree with for {name}: the best version of their case, then where you land.", 90, "contrast", "contrast"),
  // Stories
  P("s1", "stories", "story", "Tell {name} about the most embarrassing thing that happened to you this year, starting in the middle of it.", 60, "mid-action", "story"),
  P("s2", "stories", "story", "Tell {name} about a time you were wrong about someone.", 90, "question", "story"),
  P("s3", "stories", "story", "Tell {name} the story behind something in the room with you right now.", 60, "mid-action", "story"),
  P("s4", "stories", "story", "Tell {name} about a small win this week that nobody noticed.", 45, "claim", "story"),
  P("s5", "stories", "hook", "Open a storytime video for {name}. First line: the moment just before it went wrong.", 40, "mid-action", "story"),
  P("s6", "stories", "story", "Tell {name} about a teacher, boss or stranger who changed what you do, and the exact thing they said.", 90, "claim", "story"),
  // Tech
  P("x1", "tech", "opinion", "Tell {name} the one piece of tech you'd pay for again tomorrow, and the moment it proved itself.", 60, "claim", "point-reason-example"),
  P("x2", "tech", "explainer", "Explain to {name} how something you use every day actually works, simply, without talking down to them.", 90, "question", "list-of-three"),
  P("x3", "tech", "opinion", "Give {name} an honest first impression of something you tried recently: what it promised, what it did.", 60, "contrast", "contrast"),
  P("x4", "tech", "hook", "Open a review for {name}. First line: the one thing that decides whether they should buy it.", 40, "claim", "point-reason-example"),
  P("x5", "tech", "explainer", "Tell {name} three settings or habits that made a device less annoying, with the one you'd do first.", 60, "promise", "list-of-three"),
  // Fitness & health
  P("h1", "fitness", "contrast" as PromptKind, "Tell {name} how your energy is right now and the one change you're testing this week.", 60, "contrast", "contrast"),
  P("h2", "fitness", "story", "Tell {name} about a workout, walk or run that went badly and what you learned.", 60, "mid-action", "story"),
  P("h3", "fitness", "explainer", "Explain one exercise or habit to {name} in three steps, including the mistake you made at first.", 60, "promise", "list-of-three"),
  P("h4", "fitness", "opinion", "What's one piece of health advice you think is overrated? Make the case to {name}.", 60, "claim", "point-reason-example"),
  P("h5", "fitness", "hook", "Open a 'what I eat / how I train' video for {name}. Hook first, then the first real moment.", 40, "promise", "story"),
  // Money & work
  P("m1", "money", "story", "Tell {name} about the best or worst money decision you made this year, starting from the moment you decided.", 60, "mid-action", "story"),
  P("m2", "money", "opinion", "Tell {name} one thing you'd never pay for again, with the moment you realised.", 60, "claim", "point-reason-example"),
  P("m3", "money", "explainer", "Explain to {name} what you actually do at work in a way a 12-year-old could repeat.", 60, "question", "list-of-three"),
  P("m4", "money", "contrast" as PromptKind, "Tell {name} what your work days look like now and the version you're working toward.", 60, "contrast", "contrast"),
  P("m5", "money", "hook", "Open a video for {name} about a lesson from your job. First line: the lesson, bluntly.", 40, "claim", "point-reason-example"),
  // Learning / explainers
  P("l1", "learning", "explainer", "Explain something you learned this week to {name}: why it's interesting first, then the idea, then what you make of it.", 120, "question", "list-of-three"),
  P("l2", "learning", "explainer", "Pick a word or idea people misuse and explain it to {name} with one everyday example.", 60, "claim", "point-reason-example"),
  P("l3", "learning", "hook", "Open an explainer for {name}. First line: the question it answers.", 40, "question", "list-of-three"),
  P("l4", "learning", "opinion", "Tell {name} about a book, video or article that changed how you do something, and the one change.", 60, "claim", "contrast"),
  // Creative / hobbies
  P("c1", "creative", "sensory", "Show {name} something you made or are making: what it is, what it feels like in your hands, what's wrong with it.", 60, "mid-action", "sensory"),
  P("c2", "creative", "story", "Tell {name} about the project that failed and what you kept from it.", 60, "mid-action", "story"),
  P("c3", "creative", "explainer", "Teach {name} the first thing a beginner at your hobby should do, and the thing they should ignore.", 60, "promise", "list-of-three"),
  P("c4", "creative", "contrast" as PromptKind, "Tell {name} where your skill is now and where you want it in a year. One honest detail each.", 60, "contrast", "contrast"),
  P("c5", "creative", "hook", "Open a 'making a thing' video for {name}. First line: what it's for and what could go wrong.", 40, "promise", "story"),
].map((p) => (p.kind === ("contrast" as PromptKind) ? { ...p, kind: "opinion" as PromptKind } : p));

export function getPrompt(id: string): VlogPrompt | undefined {
  return PROMPTS.find((p) => p.id === id);
}

export function fillPromptText(p: VlogPrompt, viewerName: string | undefined): string {
  const name = viewerName?.trim() || "your one viewer";
  return p.text.replaceAll("{name}", name);
}

function hashDay(dayKey: string): number {
  let h = 0;
  for (const ch of dayKey) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Today's prompt: deterministic for the day, drawn from the learner's niches
 * (all niches when none are chosen), skipping prompts already done, and rotating
 * kinds so two story prompts don't land on consecutive days.
 */
export function todayPrompt(niches: Niche[], doneIds: string[], nowIso: string, offset = 0): VlogPrompt {
  const pool0 = PROMPTS.filter((p) => niches.length === 0 || niches.includes(p.niche));
  const pool = pool0.filter((p) => !doneIds.includes(p.id));
  const list = pool.length ? pool : pool0;
  const i = (hashDay(localDayKey(nowIso)) + offset) % list.length;
  return list[i]!;
}

/** Takes finished in the current week (Monday–Sunday, local). */
export function takesThisWeek(completedAts: string[], nowIso: string): number {
  const now = new Date(nowIso);
  const day = (now.getDay() + 6) % 7; // Monday = 0
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - day);
  return completedAts.filter((at) => new Date(at) >= start).length;
}

export const WEEKLY_TARGETS = [3, 5, 7] as const;
export type WeeklyTarget = (typeof WEEKLY_TARGETS)[number];

/** The creator playbook, as shown to the learner. Each line is something the app does because of it. */
export const PLAYBOOK: { who: string; what: string; inApp: string }[] = [
  { who: "Chris Anderson (TED)", what: "One idea worth spreading: a talk has a throughline the audience can repeat.", inApp: "Every take starts with a one-sentence throughline, and the coach checks a viewer could repeat it." },
  { who: "YouTube's Creator Playbook, MrBeast's team", what: "The first 15 seconds decide who stays; the first minute is where viewers leave.", inApp: "A hook pattern before you record, a hook window while you record, and your first ten seconds shown back to you." },
  { who: "Ali Abdaal", what: "Smile before the first line, warm up, don't read, speak to one person, embrace imperfection.", inApp: "Your one viewer by name in every prompt; warm-up and smile cues; cues near the lens, not a script." },
  { who: "Casey Neistat", what: "Even a daily vlog has setup, tension and payoff; shoot more than you use.", inApp: "Story prompts and the setup → turn → payoff scaffold; a short daily take instead of a long weekly session." },
  { who: "Nancy Duarte", what: "Great talks alternate what is with what could be.", inApp: "Contrast prompts and the what is → what could be scaffold." },
  { who: "Emma Chamberlain", what: "Unpolished moments and failures read as honest; viewers come for the person.", inApp: "No restarts; record-and-delete drills; the coach never grades polish or appearance." },
  { who: "Marques Brownlee", what: "Explain simply, never talk down; treat the camera as a person.", inApp: "Explainer prompts with 'a 12-year-old could repeat it'; eye-line coaching from stills." },
  { who: "Food and travel creators", what: "Taste and place don't cross the screen; texture, smell, sound and a verdict do.", inApp: "Sensory prompts, the three-senses scaffold, and a count of vague words like 'amazing'." },
  { who: "Toastmasters evaluations", what: "One commendation, one recommendation, end on what went well.", inApp: "Every feedback is one strength, one change, and a wrap-up that names what worked." },
];

// ---------- The video guide: beginning, middle, end ----------
// The shape most popular vlogs and talking-head videos share: a hook and one line
// on what this is (first ~10 s), the thing itself, then a takeaway and a question
// for the viewer (last ~15 s). Written as what to do plus one concrete example.

export interface GuideBeat {
  name: "Beginning" | "Middle" | "End";
  when: string;
  do: string;
  /** May contain {name}. */
  example: string;
}

export const VIDEO_GUIDE: Record<PromptKind, [GuideBeat, GuideBeat, GuideBeat]> = {
  quick: [
    { name: "Beginning", when: "first 10 seconds", do: "Say who you are in one line, to {name}.", example: "Hey {name}. I'm Eric, and I've spent a month trying to fix a bike that doesn't want fixing." },
    { name: "Middle", when: "the body", do: "One thing you're into right now, with a detail.", example: "Every night it's the same chain, the same grease, the same tutorial. Last night it clicked for about four seconds." },
    { name: "End", when: "last 10 seconds", do: "Ask them something.", example: "What have you been stuck on this month? Tell me." },
  ],
  story: [
    { name: "Beginning", when: "first 10 seconds", do: "Start at the moment it went wrong.", example: "So the key snapped in the lock, {name}. Half in my hand, half in the door." },
    { name: "Middle", when: "the body", do: "What you tried, what happened next.", example: "I tried the kitchen window. The neighbour came out. I ended up explaining myself to a man in a bathrobe." },
    { name: "End", when: "last 10 seconds", do: "What it left you with, then a question.", example: "Now the bathrobe man has my spare key. Where's yours?" },
  ],
  opinion: [
    { name: "Beginning", when: "first 10 seconds", do: "Say the opinion, bluntly.", example: "{name}, standing desks are overrated." },
    { name: "Middle", when: "the body", do: "One reason, and one thing that happened to you.", example: "Mine lasted three weeks. By week two I was leaning on it like a bar. My back hurt more, not less." },
    { name: "End", when: "last 10 seconds", do: "What you do instead, then ask.", example: "Now I walk for ten minutes every hour. Do you actually stand at yours?" },
  ],
  explainer: [
    { name: "Beginning", when: "first 10 seconds", do: "The question it answers.", example: "{name}, why does every app ask you to rate it right after it works?" },
    { name: "Middle", when: "the body", do: "The idea in plain words, with one example.", example: "They ask when you're happiest with it. Same reason the waiter asks about dessert when the plates are clean." },
    { name: "End", when: "last 10 seconds", do: "What to do with it, then ask.", example: "Next time one asks, notice when. Have you ever rated one star right after a crash?" },
  ],
  sensory: [
    { name: "Beginning", when: "first 10 seconds", do: "The verdict first.", example: "{name}, you have to order the dumplings at that place." },
    { name: "Middle", when: "the body", do: "Texture, smell, temperature, the first bite.", example: "The skin shattered, then it was all steam and ginger. I burned my tongue and didn't care." },
    { name: "End", when: "last 10 seconds", do: "How to do it, then ask.", example: "Order them first, skip the soup. What should I try next time?" },
  ],
  hook: [
    { name: "Beginning", when: "first 10 seconds", do: "Hook, then one line on what this is.", example: "I spent $400 on this and it lasted nine days. {name}, this is the review I wish I'd watched." },
    { name: "Middle", when: "the body", do: "The first real moment.", example: "Day one it was perfect. Day nine, this happened." },
    { name: "End", when: "last 10 seconds", do: "Say what's coming, then ask.", example: "Stick around for what I bought instead. Have you had one die this fast?" },
  ],
};

/** Who's watching and what they want, in one line. May contain {name}. */
export const AUDIENCE: Record<PromptKind, string> = {
  quick: "{name}, alone on a phone. They want it to feel like a friend talking. They stay if the first line sounds like one.",
  story: "{name}, alone on a phone. They want to know what happens. They stay if you start close to the trouble.",
  opinion: "{name}, alone on a phone. They want a real opinion and a reason. They stay if you say it in the first line.",
  explainer: "{name}, alone on a phone. They want to get one thing without being talked down to. They stay if the question is theirs.",
  sensory: "{name}, alone on a phone. They can't taste it. They stay if you give them texture and a verdict.",
  hook: "{name}, alone on a phone, deciding in ten seconds. They stay if the first line is about them or the payoff.",
};

export function fillName(text: string, viewerName: string | undefined): string {
  return text.replaceAll("{name}", viewerName?.trim() || "your one viewer");
}

/** Which beat the speaker should be in at this point of the take. */
export function currentBeat(elapsed: number, targetSeconds: number): 0 | 1 | 2 {
  if (elapsed < 10) return 0;
  if (elapsed >= Math.max(15, targetSeconds - Math.max(10, targetSeconds * 0.25))) return 2;
  return 1;
}

// ---------- Three questions per prompt ----------
// Answering three plain questions in order is easier than following instructions.
// The first opens the video, the second is the body, the third ends it.

const Q: Record<string, [string, string, string]> = {
  d1: ["What went wrong, and when?", "What did you do next?", "How did it end? What would you do differently?"],
  d2: ["Where are you right now?", "What are three things you can see, hear or smell?", "Why are you here today?"],
  d3: ["What does your morning look like right now?", "What would the better version look like?", "What's one change you'll try tomorrow?"],
  d4: ["What did you stop doing?", "What happened after you stopped?", "Would you tell {name} to try it? Why?"],
  d5: ["Who was it, and what did they say?", "Why did it stick with you?", "What would you say to them now?"],
  d6: ["What's the most interesting part of today?", "What's the first thing you're doing?", "What should {name} watch for?"],
  d7: ["What's step one?", "What are steps two and three?", "Which step do you skip, and why?"],
  d8: ["What are you looking forward to this week?", "What are you dreading?", "What would make this week a good one?"],
  f1: ["What did you eat, and where?", "What was the first bite like: texture, temperature, smell?", "Would you order it again?"],
  f2: ["What's the overrated food?", "What's your one reason?", "What meal proves it?"],
  f3: ["What do you cook well?", "What are the three steps?", "Which step do people get wrong?"],
  f4: ["What went wrong with the meal?", "What did you do about it?", "Did you eat it anyway?"],
  f5: ["What are you drinking?", "What does it smell, sound and taste like?", "Would you recommend it to {name}?"],
  f6: ["Where did you eat?", "What's the one thing to know before going?", "What should {name} order?"],
  f7: ["Which tool would you keep?", "When did it prove itself?", "What should {name} buy?"],
  t1: ["Where did you go?", "What did you hear, smell or touch there?", "What surprised you?"],
  t2: ["Where were you, and what went wrong?", "What did you do?", "How did it end?"],
  t3: ["Where would you tell {name} not to go?", "What's your one honest reason?", "Where should they go instead?"],
  t4: ["What's your first packing rule?", "What are rules two and three?", "Which one did you learn the hard way?"],
  t5: ["Where do you live, in one line?", "Where would you take {name} first?", "What should they skip?"],
  t6: ["How do you travel now?", "How would you like to travel?", "What's the first step to get there?"],
  o1: ["What's your hot take?", "Why do you believe it?", "What happened that proves it?"],
  o2: ["What does everyone say you should do?", "Why did you stop?", "What happened after?"],
  o3: ["What did you used to think?", "What changed your mind?", "What do you think now?"],
  o4: ["What's the news story, in one line?", "What's your first honest reaction?", "What do you think happens next?"],
  o5: ["What annoys you?", "Why does it bother you?", "What should change?"],
  o6: ["What's the opinion you disagree with?", "What's the best case for it?", "Where do you land?"],
  s1: ["What was happening right before?", "What was the embarrassing moment?", "How did you get out of it?"],
  s2: ["Who did you misjudge?", "What did you think, and what was true?", "What did you learn?"],
  s3: ["What's the object?", "Where did it come from?", "Why do you keep it?"],
  s4: ["What was the win?", "Why did it matter to you?", "Who would you tell first?"],
  s5: ["What was the moment just before it went wrong?", "What happened?", "How did it end?"],
  s6: ["Who was it?", "What exactly did they say?", "What do you do differently because of it?"],
  x1: ["What tech would you buy again?", "When did it prove itself?", "Who should buy it?"],
  x2: ["What do you use every day?", "How does it actually work, in plain words?", "What surprised you about it?"],
  x3: ["What did you try?", "What did it promise, and what did it do?", "Would you keep it?"],
  x4: ["What are you reviewing?", "What's the one thing that decides it?", "Buy it or skip it?"],
  x5: ["Which device?", "What are the three settings or habits?", "Which would you do first?"],
  h1: ["How is your energy right now?", "What change are you testing?", "How will you know it worked?"],
  h2: ["What went badly?", "Why do you think it happened?", "What did you learn?"],
  h3: ["What's the exercise or habit?", "What are the three steps?", "What mistake did you make at first?"],
  h4: ["What advice is overrated?", "Why?", "What do you do instead?"],
  h5: ["What's today's plan?", "What's the first real moment?", "What should {name} watch for?"],
  m1: ["What was the decision?", "What happened after?", "Would you do it again?"],
  m2: ["What would you never pay for again?", "When did you realise?", "What do you do instead?"],
  m3: ["What's your job, in one sentence?", "What do you actually do all day?", "What's the best part?"],
  m4: ["What do your work days look like now?", "What are you working toward?", "What's the next step?"],
  m5: ["What's the lesson?", "How did you learn it?", "How can {name} use it?"],
  l1: ["What did you learn this week?", "What's the main idea, in plain words?", "What do you make of it?"],
  l2: ["What word or idea do people misuse?", "What does it actually mean?", "What's an everyday example?"],
  l3: ["What question does it answer?", "What's the answer, in plain words?", "Why should {name} care?"],
  l4: ["What book, video or article?", "What did it change for you?", "Should {name} read or watch it?"],
  c1: ["What did you make?", "What does it feel like in your hands?", "What's wrong with it?"],
  c2: ["What was the project?", "What went wrong?", "What did you keep from it?"],
  c3: ["What's your hobby?", "What should a beginner do first?", "What should they ignore?"],
  c4: ["Where is your skill now?", "Where do you want it in a year?", "What's the next step?"],
  c5: ["What are you making?", "What's it for?", "What could go wrong?"],
};

/** For a topic the learner types in themselves. */
export const OWN_TOPIC_QUESTIONS: [string, string, string] = ["What is it, in one line?", "What happened, or why does it matter to you?", "What should {name} do or think now?"];

export function promptQuestions(p: VlogPrompt | undefined, viewerName: string | undefined): [string, string, string] {
  const q = (p && Q[p.id]) || OWN_TOPIC_QUESTIONS;
  return q.map((x) => fillName(x, viewerName)) as [string, string, string];
}
