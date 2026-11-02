import type { Exercise, PracticeSession, SkillId } from "./types";
import { wordCount } from "./text";

// Talk-to-camera drills (vlogging). Reviewed content: the AI adapts wording to a
// topic and gives feedback, but the ladder, the definitions of success and the
// "what good looks like" notes live here. Sources are listed in
// docs/MASTER_PLAN.md §10 (YouTube's Creator Playbook on the first 15 seconds,
// talking-head framing and lighting guides, food and travel narration guides,
// and camera-shyness practice advice).

export type CameraFocus = "comfort" | "one-person" | "specific" | "sensory" | "hook" | "story" | "opinion" | "pauses" | "moving" | "intro" | "unscripted";

export interface CameraDrill {
  id: string;
  level: number;
  title: string;
  focus: CameraFocus;
  /** Target length in seconds. The learner is never cut off. */
  seconds: number;
  /** What to do. May contain {topic}. */
  prompt: string;
  /** One line on why this matters for a viewer. */
  why: string;
  /** Three concrete marks of a good take, written for the learner. */
  goodLooksLike: string[];
  /** Does this drill need a topic from the learner (or a story)? */
  needsTopic: boolean;
  /** Record-and-delete drills skip playback and feedback on purpose. */
  noReview?: boolean;
  /** The exercise the coach evaluates against. */
  exercise: Exercise;
  /** Nearest conversation skill, for the progress table. */
  skill: SkillId;
}

const ex = (e: Exercise): Exercise => e;

export const CAMERA_DRILLS: CameraDrill[] = [
  {
    id: "cam-press-record",
    level: 1,
    title: "Just press record",
    focus: "comfort",
    seconds: 20,
    needsTopic: false,
    noReview: true,
    prompt: "Look at the lens and say your name, where you are right now, and what you had for breakfast. Then stop. The clip is deleted without being watched.",
    why: "Comfort on camera comes from repetitions, not from a perfect first take. This one is only about pressing the button.",
    goodLooksLike: ["You pressed record and talked for about 20 seconds.", "You looked at the lens at least once.", "You did not restart."],
    skill: "main-point",
    exercise: ex({
      id: "cam-press-record",
      skill: "main-point",
      difficulty: "starter",
      title: "Just press record",
      prompt: "Say your name, where you are, and what you had for breakfast.",
      successDefinition: "The learner spoke to the camera for roughly 20 seconds. Nothing else is judged.",
      exampleFeedback: "You did the only thing this drill asks: you talked to the camera. Next time, try the same with one imagined viewer in mind.",
      laterVariation: "Record a 20-second clip saying what you did today. Delete it without watching.",
    }),
  },
  {
    id: "cam-one-person",
    level: 2,
    title: "Hello, one person",
    focus: "one-person",
    seconds: 30,
    needsTopic: false,
    prompt: "Introduce yourself to one specific person you like, as if on a video call: who you are and one thing you're into at the moment. Use \"you\" at least once.",
    why: "Viewers watch alone. Creators who sound like they're talking to one friend feel natural; creators who address \"everyone\" sound like a broadcast.",
    goodLooksLike: ["It sounds like a message to one person, not an announcement.", "You said \"you\" or asked them something.", "You looked at the lens, not at your own face on the screen."],
    skill: "main-point",
    exercise: ex({
      id: "cam-one-person",
      skill: "main-point",
      difficulty: "starter",
      title: "Hello, one person",
      prompt: "Introduce yourself to one specific viewer: who you are and one thing you're into right now.",
      successDefinition: "The speaker addresses one viewer directly (uses \"you\", a question, or a direct aside) and gives one concrete thing about themselves, in about 30 seconds.",
      exampleFeedback: "\"If you've ever tried to fix a bike at midnight, you know\" is you talking to one person. The first ten seconds, though, are a list (name, job, city). Try opening with the midnight bike line.",
      laterVariation: "Leave a 30-second video message for a friend about your week, as if they'll watch it on the bus.",
    }),
  },
  {
    id: "cam-describe-place",
    level: 3,
    title: "Where I am",
    focus: "specific",
    seconds: 45,
    needsTopic: false,
    prompt: "Describe where you are right now to someone who can't see it. Give three specific details (a sound, a thing you can see, a smell or temperature) instead of general words.",
    why: "\"Amazing\" and \"really nice\" tell a viewer nothing. A specific detail puts them in the room with you.",
    goodLooksLike: ["Three details a viewer could picture, not three adjectives.", "At least one detail that isn't visual (a sound, smell, feel).", "No \"so yeah\" ending: the last line is a detail or a point."],
    skill: "example",
    exercise: ex({
      id: "cam-describe-place",
      skill: "example",
      difficulty: "starter",
      title: "Where I am",
      prompt: "Describe where you are right now with three specific details.",
      successDefinition: "At least three concrete, specific details (things a viewer could picture or hear), with general evaluative words (nice, amazing, cool) carrying little of the description.",
      exampleFeedback: "\"The fridge hums and the window's fogged from the kettle\" does the work; \"it's a really cozy place\" doesn't add anything after that. Cut the general line and give a third detail instead.",
      laterVariation: "Describe the last café or restaurant you visited in three specific details.",
    }),
  },
  {
    id: "cam-describe-food",
    level: 4,
    title: "Describe what you ate",
    focus: "sensory",
    seconds: 45,
    needsTopic: false,
    prompt: "Describe the last thing you ate or drank: texture, temperature, smell, the first bite, and one comparison (\"like…\"). Say what you'd tell a friend to order or skip.",
    why: "Food creators can't send taste through a screen, so the ones people watch describe texture, smell and the moment of the first bite instead of saying \"delicious\".",
    goodLooksLike: ["Texture or temperature named (crunchy, oily, ice-cold), not just taste.", "One comparison or memory (\"like the one my grandmother made\").", "A verdict a viewer can use: order it, skip it, or how to eat it."],
    skill: "example",
    exercise: ex({
      id: "cam-describe-food",
      skill: "example",
      difficulty: "core",
      title: "Describe what you ate",
      prompt: "Describe the last thing you ate: texture, smell, the first bite, one comparison, and a verdict.",
      successDefinition: "The description names at least two sensory qualities beyond generic taste words (texture, temperature, smell, sound, appearance), includes one comparison or reaction, and ends with a usable verdict.",
      exampleFeedback: "\"The skin shattered and then it was all steam and ginger\" is the line a viewer remembers. You said \"so good\" four times; each time, swap it for one more detail like that.",
      laterVariation: "Describe your morning coffee or tea in three sensory details and one comparison.",
    }),
  },
  {
    id: "cam-hook",
    level: 5,
    title: "Hook in ten seconds",
    focus: "hook",
    seconds: 40,
    needsTopic: true,
    prompt: "Open a video about \"{topic}\". In the first ten seconds give the viewer a reason to keep watching (a question, a surprising claim, or what they'll get), then start the first point. No \"hey guys, welcome back\".",
    why: "Most viewers decide in the first 10–15 seconds. A greeting and a channel intro are the two things they skip.",
    goodLooksLike: ["The first sentence is about the viewer or the payoff, not about you or the channel.", "Under 12 words before something interesting happens.", "The hook is honest: the body actually delivers it."],
    skill: "main-point",
    exercise: ex({
      id: "cam-hook",
      skill: "main-point",
      difficulty: "core",
      title: "Hook in ten seconds",
      prompt: "Open a video about \"{topic}\" with a hook in the first ten seconds, then begin the first point.",
      successDefinition: "The first one or two sentences give a specific reason to keep watching (a question, a claim, or a concrete promise) without a greeting, a channel intro, or throat-clearing; the next sentences begin delivering it.",
      exampleFeedback: "Your hook is in sentence three: \"I spent $400 on this and it lasted nine days.\" Sentences one and two are \"hey, so, today I wanted to talk about\". Start on sentence three.",
      laterVariation: "Write and say a one-line hook for a video about something that annoyed you this week.",
    }),
  },
  {
    id: "cam-story",
    level: 6,
    title: "Tell a 60-second story",
    focus: "story",
    seconds: 60,
    needsTopic: false,
    prompt: "Tell one small true story from this week: the setup, the moment something went wrong or surprised you, and what happened in the end. Start as close to the problem as you can.",
    why: "Vlogs that hold attention have a shape (setup, tension, payoff) even when they're \"just\" a day. Failure and surprise are what make a story feel real.",
    goodLooksLike: ["A clear setup, a turn, and a payoff.", "The turn arrives before the halfway mark.", "One concrete detail in the moment of tension."],
    skill: "organize",
    exercise: ex({
      id: "cam-story",
      skill: "organize",
      difficulty: "core",
      title: "Tell a 60-second story",
      prompt: "Tell one small true story from this week with a setup, a turn, and a payoff.",
      successDefinition: "The story has an identifiable setup, a turn (something went wrong, changed or surprised), and a resolution, in that order; the turn comes before the halfway point.",
      exampleFeedback: "The turn (\"and then the key snapped in the lock\") lands at 45 seconds of a 60-second take. Cut the background about why you were there to one line and get to the key by 15 seconds.",
      laterVariation: "Tell the story of a small mistake you made at work and what you did next.",
    }),
  },
  {
    id: "cam-opinion",
    level: 7,
    title: "An opinion with a reason",
    focus: "opinion",
    seconds: 60,
    needsTopic: true,
    prompt: "Give your honest opinion on \"{topic}\" in one sentence, then one reason, then one specific example from your own experience. End by asking the viewer what they think.",
    why: "Personality on camera is mostly having a point of view and backing it with something that happened to you. Hedging and \"it depends\" read as nothing.",
    goodLooksLike: ["The opinion is one clear sentence near the start.", "The example is yours (a person, a moment, a number).", "You end with a direct question to the viewer."],
    skill: "example",
    exercise: ex({
      id: "cam-opinion",
      skill: "example",
      difficulty: "core",
      title: "An opinion with a reason",
      prompt: "Give your opinion on \"{topic}\": one sentence, one reason, one example from your experience, then ask the viewer what they think.",
      successDefinition: "A clearly stated opinion near the start, one reason, one specific first-hand example, and a closing question to the viewer.",
      exampleFeedback: "\"Standing desks are overrated\" is a real opinion, and the back-pain story is the example. The reason is missing: why did it not work for you? One sentence between the two would fix it.",
      laterVariation: "Give your opinion on a product you use every day, with one example of when it mattered.",
    }),
  },
  {
    id: "cam-pauses",
    level: 8,
    title: "Pause, don't fill",
    focus: "pauses",
    seconds: 60,
    needsTopic: true,
    prompt: "Talk for a minute about \"{topic}\" with one rule: whenever you'd say \"um\", \"like\" or \"you know\", stop talking instead. Let the silence sit, then continue. Don't restart.",
    why: "On camera, silence reads as confidence and fillers read as nerves. Filler-word apps count them; the fix is the same everywhere: replace the filler with a pause.",
    goodLooksLike: ["Pauses where fillers would have been.", "You kept going after a stumble instead of restarting.", "The take still has a point and an ending."],
    skill: "main-point",
    exercise: ex({
      id: "cam-pauses",
      skill: "main-point",
      difficulty: "core",
      title: "Pause, don't fill",
      prompt: "Talk for a minute about \"{topic}\", pausing wherever you'd use a filler word.",
      successDefinition: "The take makes one clear point in about a minute and, as far as the transcript shows, uses few or no filler words or phrases (um, uh, like, you know, sort of); stumbles are followed by continuing, not restarting.",
      exampleFeedback: "Two \"you know\"s in sixty seconds is already low. The point (\"buy the cheaper one and replace it twice\") lands in the first sentence; the ending trails off with \"so yeah\". End on the point instead.",
      laterVariation: "Explain something you know well for one minute with no fillers; if one slips out, pause and continue.",
    }),
  },
  {
    id: "cam-walk",
    level: 9,
    title: "Walk and talk",
    focus: "moving",
    seconds: 60,
    needsTopic: false,
    prompt: "Hold the phone at arm's length and walk (or move around the room) while telling the viewer what you're doing right now and what's next. Keep your face in the frame and glance at the lens.",
    why: "Most vlogging happens while moving. The skills are keeping yourself in frame, keeping the thread going, and treating the lens like a friend walking next to you.",
    goodLooksLike: ["Your face stays in the frame most of the time.", "You keep talking through a pause or stumble instead of restarting.", "The viewer knows what you're doing and what's coming next."],
    skill: "organize",
    exercise: ex({
      id: "cam-walk",
      skill: "organize",
      difficulty: "stretch",
      title: "Walk and talk",
      prompt: "While moving, tell the viewer what you're doing right now and what's next.",
      successDefinition: "The viewer learns what the speaker is doing now and what comes next, the thread continues through any stumble, and the speaker keeps addressing the viewer.",
      exampleFeedback: "You kept the thread even when the door stuck (\"okay, that's the door, anyway\"), which is exactly right. What's next never came: end on where you're heading.",
      laterVariation: "Film a 60-second walk-and-talk on your way somewhere, saying where you're going and why.",
    }),
  },
  {
    id: "cam-intro",
    level: 10,
    title: "A full vlog opening",
    focus: "intro",
    seconds: 90,
    needsTopic: true,
    prompt: "Record the first 90 seconds of a vlog about \"{topic}\": a hook, what today's video is about in one line, and the first moment of the day. Talk to one person.",
    why: "This is the part of every video viewers actually judge. Hook, promise, first scene: in that order.",
    goodLooksLike: ["Hook before any greeting.", "One line that says what the video is.", "The first real moment starts before 30 seconds."],
    skill: "conclusion",
    exercise: ex({
      id: "cam-intro",
      skill: "conclusion",
      difficulty: "stretch",
      title: "A full vlog opening",
      prompt: "The first 90 seconds of a vlog about \"{topic}\": hook, one-line promise, first moment.",
      successDefinition: "A hook in the first sentences, a one-line statement of what the video is about, and the beginning of the first concrete moment, all within about 90 seconds and addressed to a viewer.",
      exampleFeedback: "Hook, promise and first moment are all here. The promise (\"today we're going to see if the night market is worth it\") came after a 20-second greeting; move it to second place.",
      laterVariation: "Record the first 90 seconds of a vlog about an ordinary day, with the hook first.",
    }),
  },
  {
    id: "cam-unscripted",
    level: 11,
    title: "Unscripted: explain something you read",
    focus: "unscripted",
    seconds: 120,
    needsTopic: true,
    prompt: "Without notes, explain \"{topic}\" to a viewer who hasn't heard of it: why it's interesting, the main idea, and what you make of it. Two minutes, one take.",
    why: "A vlogger with something to say is more watchable than one with a nice setup. This connects the reading you do in the app with talking to camera about it.",
    goodLooksLike: ["Why it's interesting comes first, not the background.", "The main idea is in your own words.", "You say what you think, not just what the source said."],
    skill: "main-point",
    exercise: ex({
      id: "cam-unscripted",
      skill: "main-point",
      difficulty: "stretch",
      title: "Unscripted explanation to camera",
      prompt: "Explain \"{topic}\" to a viewer who hasn't heard of it: why it's interesting, the main idea, and your take.",
      successDefinition: "Opens with why the topic is interesting, states the main idea clearly in the speaker's own words, and gives the speaker's own view, in one take of about two minutes.",
      exampleFeedback: "\"Here's the bit that got me\" is a great way in, and the main idea is clear. Your own take is one word (\"interesting\"); say what you'd do differently because of it.",
      laterVariation: "Explain the last article you read to a viewer in two minutes, with your own take at the end.",
    }),
  },
];

export const CAMERA_EXERCISES: Exercise[] = CAMERA_DRILLS.map((d) => d.exercise);

export function getCameraDrill(id: string): CameraDrill {
  const d = CAMERA_DRILLS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown camera drill: ${id}`);
  return d;
}

export function isCameraDrill(id: string): boolean {
  return CAMERA_DRILLS.some((x) => x.id === id);
}

/** Five things to check before recording, from talking-head framing and lighting guides. */
export const CAMERA_SETUP: { id: string; text: string; why: string }[] = [
  { id: "eye-level", text: "Lens at eye level", why: "A low phone looks up your nose; a high one makes you look small. Prop it up." },
  { id: "light", text: "Light on your face, not behind you", why: "Face a window or a lamp. A window behind you turns you into a silhouette." },
  { id: "distance", text: "An arm's length from the wall", why: "Space behind you looks like a room; a wall right behind you looks like a passport photo." },
  { id: "headroom", text: "Eyes about a third of the way down the frame", why: "A hand's width of space above your head, both shoulders in the frame." },
  { id: "lens", text: "Look at the lens, not at yourself", why: "The lens is the viewer's eyes. Your own face on the screen pulls your eyes down." },
];

/** Principles the drills and the coach's rubric are built on. Shown to the learner once. */
export const CAMERA_PRINCIPLES: { title: string; text: string }[] = [
  { title: "Talk to one person", text: "Viewers watch alone. Say \"you\", not \"everyone\". Picture one friend on a video call." },
  { title: "Hook before hello", text: "Most viewers decide in the first 10–15 seconds. Open with the reason to watch, not a greeting or a channel intro." },
  { title: "Specific beats impressive", text: "\"The skin shattered\" beats \"so delicious\". Name textures, sounds, numbers, moments." },
  { title: "Shape, even for a day", text: "Setup, a turn, a payoff. Start close to the problem. Failure is good material." },
  { title: "Be yourself, plus ten percent", text: "The camera flattens you. Speak slightly louder and more varied than in conversation, and let your hands move." },
  { title: "Cues, not a script", text: "Reading a script sounds like reading. Three words near the lens beat a teleprompter for most takes; write how you talk." },
  { title: "Pause, don't fill", text: "Silence reads as confidence; \"um\" and \"like\" read as nerves. If you stumble, pause and keep going. Don't restart." },
  { title: "Repetition over perfection", text: "Comfort comes from takes, not from the right gear. Short daily clips beat a long weekly session." },
];

export interface DrillProgress {
  drill: CameraDrill;
  completed: number;
  lastAt?: string;
}

export function cameraProgress(sessions: PracticeSession[]): DrillProgress[] {
  return CAMERA_DRILLS.map((drill) => {
    const done = sessions.filter((s) => s.mode === "camera" && s.camera?.drillId === drill.id && !s.camera.promptId && s.completedAt);
    const lastAt = done.map((s) => s.completedAt!).sort().pop();
    return { drill, completed: done.length, lastAt };
  });
}

/** The next drill to suggest: the lowest level not yet completed, then the least-practised. */
export function nextCameraDrill(sessions: PracticeSession[]): CameraDrill {
  const prog = cameraProgress(sessions);
  const fresh = prog.find((p) => p.completed === 0);
  if (fresh) return fresh.drill;
  return [...prog].sort((a, b) => a.completed - b.completed || a.drill.level - b.drill.level)[0]!.drill;
}

// ---------- Deterministic measures (shown with their basis; never a score) ----------

const FILLERS = ["um", "uh", "uhm", "erm", "er", "ah", "hmm", "mmm", "you know", "i mean", "sort of", "kind of", "basically", "literally", "like"];
const GENERIC = ["amazing", "awesome", "nice", "great", "good", "cool", "incredible", "delicious", "beautiful", "really", "very", "so good", "interesting", "crazy", "insane"];

function countPhrases(text: string, phrases: string[]): { phrase: string; count: number }[] {
  const t = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}'’ ]+/gu, " ").replace(/\s+/g, " ")} `;
  const out: { phrase: string; count: number }[] = [];
  for (const p of phrases) {
    let count = 0;
    let i = 0;
    const needle = ` ${p} `;
    while ((i = t.indexOf(needle, i)) >= 0) {
      count++;
      i += needle.length - 1;
    }
    if (count) out.push({ phrase: p, count });
  }
  return out;
}

/** Filler words and phrases found in a transcript. Speech recognizers often drop "um"/"uh", so this undercounts. */
export function fillerWords(text: string): { total: number; items: { phrase: string; count: number }[] } {
  const items = countPhrases(text, FILLERS);
  return { total: items.reduce((n, x) => n + x.count, 0), items };
}

/** Vague evaluative words that carry little description. */
export function genericWords(text: string): { total: number; items: { phrase: string; count: number }[] } {
  const items = countPhrases(text, GENERIC);
  return { total: items.reduce((n, x) => n + x.count, 0), items };
}

/** How often the speaker addresses the viewer directly. */
export function viewerAddress(text: string): number {
  return countPhrases(text, ["you", "your", "you're", "you've", "you'll"]).reduce((n, x) => n + x.count, 0);
}

/** Roughly what a viewer hears in the first ten seconds (about 25 words). */
export function hookText(text: string, words = 25): string {
  const m = text.trim().match(/\S+/g) ?? [];
  const slice = m.slice(0, words).join(" ");
  return m.length > words ? `${slice}…` : slice;
}

export function wordsPerMinute(text: string, seconds: number | undefined): number | null {
  if (!seconds || seconds < 5) return null;
  return Math.round((wordCount(text) / seconds) * 60);
}

export interface CameraMeasure {
  label: string;
  value: string;
  basis: string;
}

/** Measures for a camera take. All computed locally from the transcript and timer. */
export function measureCameraTake(text: string, seconds: number | undefined, transcriptSource?: string): CameraMeasure[] {
  const out: CameraMeasure[] = [];
  const wpm = wordsPerMinute(text, seconds);
  if (wpm != null) {
    out.push({
      label: "Pace",
      value: `about ${wpm} words per minute`,
      basis: wpm < 120 ? "Word count over recording length. Conversational video usually sits around 140–170; under 120 can feel slow." : wpm > 180 ? "Word count over recording length. Over about 180 is fast for most viewers; pauses help." : "Word count over recording length. This is a comfortable range for talking to camera.",
    });
  }
  const f = fillerWords(text);
  out.push({
    label: "Fillers",
    value: f.total === 0 ? "none found" : f.items.map((x) => `“${x.phrase}” ×${x.count}`).join(", "),
    basis: transcriptSource === "browser-speech" ? "Counted in the transcript. Browser speech recognition usually removes “um” and “uh”, so this undercounts." : "Counted in the transcript. “Like” is counted even when it isn't a filler.",
  });
  const g = genericWords(text);
  if (g.total > 0) {
    out.push({ label: "General words", value: g.items.map((x) => `“${x.phrase}” ×${x.count}`).join(", "), basis: "Words that evaluate without describing. Each one is a chance for a specific detail." });
  }
  const you = viewerAddress(text);
  out.push({ label: "Talking to the viewer", value: you === 0 ? "no “you”" : `“you” ×${you}`, basis: "How often you addressed the viewer directly." });
  return out;
}

// ---------- Visible improvement ----------

export interface TakeStats {
  wpm: number | null;
  fillersPerMinute: number | null;
  genericPerMinute: number | null;
  you: number;
  words: number;
}

export function takeStats(text: string, seconds: number | undefined): TakeStats {
  const words = wordCount(text);
  const minutes = seconds && seconds >= 5 ? seconds / 60 : null;
  return {
    wpm: wordsPerMinute(text, seconds),
    fillersPerMinute: minutes ? Math.round((fillerWords(text).total / minutes) * 10) / 10 : null,
    genericPerMinute: minutes ? Math.round((genericWords(text).total / minutes) * 10) / 10 : null,
    you: viewerAddress(text),
    words,
  };
}

export interface Improvement {
  label: string;
  before: string;
  after: string;
  /** Whether the change is in the helpful direction. Null when neither direction is better. */
  better: boolean | null;
}

/** Plain before/after lines between the learner's first take and this one. Directions follow the creator guidance; never a score. */
export function improvementSince(first: TakeStats, latest: TakeStats): Improvement[] {
  const out: Improvement[] = [];
  if (first.fillersPerMinute != null && latest.fillersPerMinute != null && first.fillersPerMinute !== latest.fillersPerMinute) {
    out.push({ label: "Fillers per minute", before: String(first.fillersPerMinute), after: String(latest.fillersPerMinute), better: latest.fillersPerMinute < first.fillersPerMinute });
  }
  if (first.wpm != null && latest.wpm != null && first.wpm !== latest.wpm) {
    const inRange = (w: number) => w >= 120 && w <= 180;
    out.push({ label: "Pace (words per minute)", before: String(first.wpm), after: String(latest.wpm), better: inRange(latest.wpm) && !inRange(first.wpm) ? true : !inRange(latest.wpm) && inRange(first.wpm) ? false : null });
  }
  if (first.genericPerMinute != null && latest.genericPerMinute != null && first.genericPerMinute !== latest.genericPerMinute) {
    out.push({ label: "Vague words per minute", before: String(first.genericPerMinute), after: String(latest.genericPerMinute), better: latest.genericPerMinute < first.genericPerMinute });
  }
  if (first.you !== latest.you) out.push({ label: "Times you said “you”", before: String(first.you), after: String(latest.you), better: latest.you > first.you });
  return out;
}
