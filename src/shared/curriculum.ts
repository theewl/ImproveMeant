import type { Exercise, Mission, Scenario, SkillId } from "./types";

// Reviewed curriculum. AI may adapt the wording of an exercise to a topic,
// but the skill, success definition and teaching approach live here.
// Reviewed by: product team (v1, 2026-11). Changes should be reviewed, not generated.

export const SKILLS: Record<SkillId, { name: string; short: string; why: string }> = {
  "main-point": {
    name: "State a clear main point",
    short: "Main point",
    why: "Listeners decide early whether they follow you. A main point in the first sentence or two gives them something to hold on to.",
  },
  organize: {
    name: "Organize supporting ideas",
    short: "Organize",
    why: "Two or three supports in a clear order are easier to follow than everything you know in the order you thought of it.",
  },
  example: {
    name: "Give a concrete example",
    short: "Example",
    why: "A specific case (a person, a number, a moment) makes an abstract point believable and memorable.",
  },
  conclusion: {
    name: "End with a clear conclusion or request",
    short: "Conclusion",
    why: "People act on what you ask for explicitly. Ending on a clear takeaway or request tells them what to do with what they heard.",
  },
};

export const SKILL_ORDER: SkillId[] = ["main-point", "organize", "example", "conclusion"];

export const EXERCISES: Exercise[] = [
  // --- Main point ---
  {
    id: "mp-explain-story",
    skill: "main-point",
    difficulty: "starter",
    title: "Explain the main idea",
    prompt: "Without looking, explain the main idea of \"{topic}\" to a colleague who hasn't read it. Lead with the point.",
    successDefinition:
      "The first one or two sentences state the central idea in the speaker's own words; details come after, and nothing important is factually wrong.",
    exampleFeedback:
      "Your main point (\"cheap batteries are changing who can store solar power\") arrives in your fourth sentence, after the history. Try opening with that sentence, then give the history as one supporting detail.",
    laterVariation:
      "Your manager stops you in the hallway: \"What was that meeting about?\" Answer in two sentences with the main point first.",
  },
  {
    id: "mp-one-sentence",
    skill: "main-point",
    difficulty: "core",
    title: "One-sentence version",
    prompt: "Summarize \"{topic}\" in a single sentence someone could repeat to a friend.",
    successDefinition: "One sentence that a listener could repeat accurately; no hedging preamble.",
    exampleFeedback:
      "You met this goal: \"Cities are cooling streets by planting trees where heat is worst\" is one repeatable sentence.",
    laterVariation: "Describe your current project in one sentence a new teammate could repeat.",
  },
  {
    id: "mp-introduce",
    skill: "main-point",
    difficulty: "starter",
    title: "Introduce yourself with a point",
    prompt:
      "Introduce yourself to {audience}. Instead of a list of facts, lead with one thing you want them to remember about you.",
    successDefinition:
      "The opening states what the listener should remember (a focus, strength or reason to talk to you) before background details.",
    exampleFeedback:
      "You open with your job title and two past roles; the memorable part (\"I'm the person who turns customer complaints into fixes\") comes last. Try leading with it.",
    laterVariation: "Introduce yourself at the start of a call with a new client team, leading with why you're on the call.",
  },
  {
    id: "fu-answer-directly",
    skill: "main-point",
    difficulty: "core",
    title: "Answer the question directly",
    prompt: "Answer the follow-up question. Lead with your answer, then give one reason or example.",
    successDefinition: "The first sentence answers the question that was asked; one reason or example follows; no long preamble.",
    exampleFeedback:
      "You answered the question in your last sentence (\"so yes, I'd start with the pilot\"). Move that to the front, then give your reason.",
    laterVariation: "Someone asks \"Why does this matter?\" about your work. Answer in the first sentence, then give one example.",
  },
  // --- Organize ---
  {
    id: "org-two-reasons",
    skill: "organize",
    difficulty: "core",
    title: "Point plus two supports",
    prompt: "Explain \"{topic}\" as one main point supported by two distinct reasons or pieces of evidence.",
    successDefinition:
      "A listener can identify one main point and two separate supports; the supports don't repeat each other.",
    exampleFeedback:
      "Your two reasons both describe cost (\"cheaper panels\" and \"lower prices\"). Replace one with a different kind of support, such as policy or reliability.",
    laterVariation: "Recommend a restaurant for a team lunch: one recommendation, two different reasons.",
  },
  {
    id: "org-explain-group",
    skill: "organize",
    difficulty: "core",
    title: "Explain an idea to a group",
    prompt:
      "Explain {topic} to {audience}. Signal your structure so they can follow (for example, \"two things matter here...\").",
    successDefinition:
      "The talk has a stated main point, signposted supports in a sensible order, and no long detours.",
    exampleFeedback:
      "Saying \"there are two reasons\" helped. The second reason drifted into a story about your team; cut that to one sentence and return to the point.",
    laterVariation: "Explain a process you know well (e.g. onboarding a new hire) to a group of newcomers in three signposted steps.",
  },
  {
    id: "org-what-so-what",
    skill: "organize",
    difficulty: "core",
    title: "What? So what? Now what?",
    prompt:
      "Explain \"{topic}\" in three short parts, in this order: What (what it is), So what (why it matters to the listener), Now what (what to do or watch for). You can use the stems \"The idea is…\", \"This matters because…\", \"So the next step is…\".",
    successDefinition:
      "All three parts appear, in order, and each is one to three sentences. The 'so what' is about the listener, not a restatement of the 'what'.",
    exampleFeedback:
      "Your 'what' and 'so what' are clear. The 'now what' is missing: you ended on why it matters. Add one sentence on what the listener could do or watch for.",
    laterVariation: "Someone asks what you've been working on. Answer in three parts: what it is, why it matters to them, what happens next.",
  },
  {
    id: "org-stretch-objection",
    skill: "organize",
    difficulty: "stretch",
    title: "Address the obvious objection",
    prompt: "Explain {topic}, then name the most likely objection and answer it briefly.",
    successDefinition: "The response states a position, names one fair objection, and answers it without abandoning the main point.",
    exampleFeedback:
      "You named the objection (\"won't this cost more?\") but didn't answer it. Add one sentence with your best response.",
    laterVariation: "Propose a later start time for a weekly meeting and handle the objection that some people leave early.",
  },
  // --- Example ---
  {
    id: "ex-concrete-case",
    skill: "example",
    difficulty: "starter",
    title: "Make it concrete",
    prompt: "Explain \"{topic}\" and include one concrete example: a specific person, place, number or moment.",
    successDefinition:
      "At least one example is specific enough to picture and clearly connected to the main point.",
    exampleFeedback:
      "\"It affects a lot of people\" is general. You mentioned the town in the article; naming it and the number of homes affected would make the point concrete.",
    laterVariation: "Explain why a habit of yours works, using one specific day when it helped.",
  },
  {
    id: "ex-twelve",
    skill: "example",
    difficulty: "core",
    title: "Explain it to a curious 12-year-old",
    prompt: "Explain \"{topic}\" to a curious 12-year-old. No jargon; use one example from everyday life they'd recognise.",
    successDefinition:
      "No unexplained technical terms, at least one everyday example, and the main idea survives the simplification without becoming wrong.",
    exampleFeedback:
      "\"Incentives\" would need explaining to a 12-year-old. You could say \"rewards\" and keep your pocket-money example, which works well.",
    laterVariation: "Explain what your job involves to a curious 12-year-old, with one example from their world.",
  },
  {
    id: "ex-analogy",
    skill: "example",
    difficulty: "core",
    title: "Explain with a comparison",
    prompt: "Explain \"{topic}\" to someone new to it, using one everyday comparison or example they already know.",
    successDefinition:
      "The comparison is familiar to the stated audience, accurate enough not to mislead, and tied back to the point.",
    exampleFeedback:
      "Comparing the grid to a water system works. Say what the battery is in that picture (a tank) so the comparison finishes its job.",
    laterVariation: "Explain what your team does to a relative, using one everyday comparison.",
  },
  {
    id: "ex-persuade",
    skill: "example",
    difficulty: "stretch",
    title: "Short persuasive talk",
    prompt:
      "Persuade {audience} that {topic}. Support your position with at least one concrete example, and acknowledge one limitation.",
    successDefinition:
      "Clear position, at least one specific example, one honest limitation; persuasion rests on reasoning rather than volume of claims.",
    exampleFeedback:
      "Your position is clear. The support is three general claims; swap one for the concrete example you mentioned at the end (the pilot in your office).",
    laterVariation: "Persuade a friend to try a book or podcast, using one specific moment from it.",
  },
  // --- Conclusion ---
  {
    id: "con-takeaway",
    skill: "conclusion",
    difficulty: "starter",
    title: "End on the takeaway",
    prompt: "Explain \"{topic}\" and finish with one sentence: what should the listener take away or do?",
    successDefinition: "The last sentence is a clear takeaway or action, not a trailing \"so yeah\" or a new detail.",
    exampleFeedback:
      "You ended on a new statistic, which opens a new thread. End instead with the sentence you said in the middle: \"So the cheapest fix is better insulation.\"",
    laterVariation: "Finish a status update with a single clear sentence about what you need from the team this week.",
  },
  {
    id: "con-propose-change",
    skill: "conclusion",
    difficulty: "core",
    title: "Propose a change in a meeting",
    prompt:
      "In a meeting with {audience}, propose this change: {topic}. Make the request explicit and give one reason.",
    successDefinition:
      "The request is stated explicitly (who, what, when if relevant), appears early or is clearly repeated at the end, and is supported by at least one reason.",
    exampleFeedback:
      "Your request appears after three background details. Try opening with the request, then give one reason.",
    laterVariation: "Ask a colleague to review your work by Friday: lead with the request and one reason it matters.",
  },
  {
    id: "con-call-to-action",
    skill: "conclusion",
    difficulty: "stretch",
    title: "Close with a specific next step",
    prompt: "Explain \"{topic}\" and close with a specific next step the listener could take this week.",
    successDefinition: "The closing names a concrete, doable next step connected to the main point.",
    exampleFeedback:
      "\"We should think about it more\" isn't a next step. Name one action, e.g. \"read the two-page summary before Thursday.\"",
    laterVariation: "End a 1:1 with your manager by naming one specific thing you'll do before your next meeting.",
  },
];

export const SCENARIOS: Scenario[] = [
  {
    id: "introduce",
    title: "Introduce yourself",
    description: "A short introduction that leaves people with one thing to remember.",
    primarySkill: "main-point",
    exerciseId: "mp-introduce",
    defaultAudience: "a new project team",
    defaultOutcome: "They know what I do and when to come to me",
    sampleQuestions: {
      supportive: [
        "What kind of problems do you most enjoy working on?",
        "How did you end up in this role?",
      ],
      challenging: [
        "You mentioned several things. Which one should we actually come to you for?",
        "How is that different from what the rest of the team already does?",
      ],
    },
  },
  {
    id: "explain-group",
    title: "Explain an idea to a group",
    description: "Help a group understand something they don't know yet.",
    primarySkill: "organize",
    exerciseId: "org-explain-group",
    defaultAudience: "colleagues from another department",
    defaultOutcome: "They understand the idea well enough to explain it back",
    sampleQuestions: {
      supportive: [
        "Can you give an example of where this shows up in practice?",
        "What's the one thing we should remember from this?",
      ],
      challenging: [
        "How do we know that's actually true, rather than just a popular idea?",
        "Why should this matter to people in our role?",
      ],
    },
  },
  {
    id: "propose-change",
    title: "Propose a change in a meeting",
    description: "Ask for a specific change and give a reason people can accept.",
    primarySkill: "conclusion",
    exerciseId: "con-propose-change",
    defaultAudience: "my team lead and three teammates",
    defaultOutcome: "They agree to try the change for two weeks",
    sampleQuestions: {
      supportive: ["What would you need from us to try this?", "How would we know if it's working?"],
      challenging: [
        "We tried something like this before and it didn't stick. What's different now?",
        "What does this cost us in time this month?",
      ],
    },
  },
  {
    id: "persuade",
    title: "Give a short persuasive talk",
    description: "Take a position and support it with reasons and an example.",
    primarySkill: "example",
    exerciseId: "ex-persuade",
    defaultAudience: "a mixed group of colleagues",
    defaultOutcome: "They take my position seriously, even if they disagree",
    sampleQuestions: {
      supportive: ["What first convinced you of this?", "Where would you start if we wanted to act on this?"],
      challenging: [
        "What's the strongest argument against your position?",
        "Your example is one case. Why should we think it generalises?",
      ],
    },
  },
];

export const MISSIONS: Mission[] = [
  {
    id: "explain-friend",
    title: "Explain today's idea to a friend",
    description: "In a real conversation, explain one idea you practiced. Did they get the main point?",
    skill: "main-point",
  },
  {
    id: "ask-meeting",
    title: "Ask a question in a meeting",
    description: "Ask one clear question in a meeting this week, leading with what you want to know.",
    skill: "main-point",
  },
  {
    id: "opening-no-notes",
    title: "Deliver an opening without notes",
    description: "Open a meeting or presentation with your main point, without reading it.",
    skill: "conclusion",
  },
];

export function getExercise(id: string): Exercise {
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw new Error(`Unknown exercise ${id}`);
  return ex;
}

export function getScenario(id: string): Scenario {
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) throw new Error(`Unknown scenario ${id}`);
  return sc;
}

/** Learn & Explain exercises per skill, easier first. Later entries are harder versions of the same skill. */
export const LEARN_EXERCISES: Record<SkillId, string[]> = {
  "main-point": ["mp-explain-story", "mp-one-sentence"],
  organize: ["org-two-reasons", "org-what-so-what", "org-stretch-objection"],
  example: ["ex-concrete-case", "ex-twelve", "ex-analogy"],
  conclusion: ["con-takeaway", "con-call-to-action"],
};

/** Progress to the harder version once the goal has been met twice with real (live) feedback. */
export const PROGRESSION_THRESHOLD = 2;

export function pickLearnExerciseForSkill(skill: SkillId, goalMetLiveCount: number): Exercise {
  const ids = LEARN_EXERCISES[skill];
  const level = Math.min(ids.length - 1, Math.floor(goalMetLiveCount / PROGRESSION_THRESHOLD));
  return getExercise(ids[level]!);
}

/**
 * Deterministic choice of the Learn & Explain exercise outside a plan: start with the
 * main point, then rotate through skills; within a skill, progress by goals met.
 */
export function pickLearnExercise(completedLearnSessions: number, goalMetBySkill: Partial<Record<SkillId, number>> = {}): Exercise {
  const skill = completedLearnSessions < 2 ? "main-point" : SKILL_ORDER[completedLearnSessions % SKILL_ORDER.length]!;
  return pickLearnExerciseForSkill(skill, goalMetBySkill[skill] ?? 0);
}

export function fillPrompt(template: string, vars: { topic?: string; audience?: string }): string {
  return template
    .replaceAll("{topic}", vars.topic?.trim() || "your topic")
    .replaceAll("{audience}", vars.audience?.trim() || "your audience");
}
