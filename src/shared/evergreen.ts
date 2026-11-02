import type { Briefing, Interest, StoryCard } from "./types";

// Curated evergreen library. Briefings are original text written for this app
// from general knowledge, each linked to a public reference for further reading.
// They are not excerpts of the linked pages. Review date applies to all items.
export const EVERGREEN_REVIEWED_AT = "2026-11-01T00:00:00.000Z";

interface EvergreenEntry {
  card: Omit<StoryCard, "whySelected" | "briefingReady" | "kind" | "estimatedMinutes"> & { estimatedMinutes?: number };
  briefing: Omit<Briefing, "storyId" | "kind" | "title" | "source" | "coverage" | "generatedBy" | "generatedAt" | "sourceVersion" | "supportingExcerpts">;
}

const wiki = (title: string) => `https://en.wikipedia.org/wiki/${title}`;

const ENTRIES: EvergreenEntry[] = [
  {
    card: {
      id: "eg-curse-of-knowledge",
      title: "The curse of knowledge",
      description: "Once you know something, it's hard to imagine not knowing it — which is why experts often explain badly.",
      interest: "culture",
      source: { url: wiki("Curse_of_knowledge"), publisher: "Wikipedia (reference)", publishedAt: "Idea named 1989", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Economists Colin Camerer, George Loewenstein and Martin Weber named the \"curse of knowledge\" in 1989: better-informed people struggle to reason as if they knew less.",
        "In a well-known 1990 study by Elizabeth Newton, people tapped the rhythm of familiar songs. Tappers expected listeners to name about half the songs; listeners named roughly 1 in 40.",
        "For speakers, the risk is skipping steps and using shorthand that feels obvious only because you already know it.",
      ],
      mainIdea: "Knowing something makes it hard to imagine not knowing it, so experts tend to overestimate how clear their explanations are.",
      uncertainty: "The tapping study is a single classic experiment that is often retold; the general bias is well supported, but the exact numbers come from one setting.",
      keyTerm: {
        term: "curse of knowledge",
        meaning: "The difficulty of imagining what it's like not to know something you know.",
        inContext: null,
        exampleUse: "I think the curse of knowledge is hitting me here — let me back up and define the acronym.",
      },
      followUpQuestion: "What's one habit that would help an expert avoid the curse of knowledge when explaining their work?",
    },
  },
  {
    card: {
      id: "eg-mehrabian-myth",
      title: "The \"93% of communication is non-verbal\" myth",
      description: "A famous statistic about words, tone and body language is widely misapplied.",
      interest: "culture",
      source: { url: wiki("Albert_Mehrabian"), publisher: "Wikipedia (reference)", publishedAt: "Studies published 1967", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Psychologist Albert Mehrabian's 1960s experiments are the source of the \"7% words, 38% tone, 55% face\" figures.",
        "The studies asked people to judge feelings from single words when the word, tone and expression conflicted — not to understand ordinary messages.",
        "Mehrabian has said the figures don't apply to communication in general; in most talks, what you say carries the content.",
      ],
      mainIdea: "The 7-38-55 rule comes from narrow experiments about conflicting emotional cues, so it doesn't mean words matter only 7% in normal communication.",
      uncertainty: "Tone and body language clearly matter for how a message is received; what's unsupported is the precise split applied to everyday speaking.",
      keyTerm: {
        term: "overgeneralize",
        meaning: "To apply a finding from a narrow situation to situations it was never tested on.",
        inContext: null,
        exampleUse: "That survey was of one office, so let's not overgeneralize it to the whole company.",
      },
      followUpQuestion: "If someone quotes the 93% statistic in a training, how would you politely correct it in one or two sentences?",
    },
  },
  {
    card: {
      id: "eg-goodhart",
      title: "Goodhart's law: when measures become targets",
      description: "Why chasing a metric can quietly break what the metric was supposed to measure.",
      interest: "business",
      source: { url: wiki("Goodhart%27s_law"), publisher: "Wikipedia (reference)", publishedAt: "Idea from 1975", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Economist Charles Goodhart observed in 1975 that statistical relationships used for policy tend to break down once people are pressured to hit them.",
        "Anthropologist Marilyn Strathern's later paraphrase became the popular version: \"When a measure becomes a target, it ceases to be a good measure.\"",
        "Example: if a support team is judged only on how fast tickets are closed, tickets may get closed without the problem being solved.",
      ],
      mainIdea: "When people are rewarded for hitting a number, they find ways to move the number that don't improve the thing it was meant to track.",
      uncertainty: "It's a pattern, not an exact law: some targets work well, especially when combined with other measures and judgment.",
      keyTerm: {
        term: "proxy",
        meaning: "Something easy to measure that stands in for something harder to measure.",
        inContext: null,
        exampleUse: "Ticket-close time is only a proxy for whether customers got help.",
      },
      followUpQuestion: "Think of a metric at work or school. How could someone hit it without achieving its real purpose?",
    },
  },
  {
    card: {
      id: "eg-opportunity-cost",
      title: "Opportunity cost",
      description: "The real cost of a choice includes the best thing you gave up to make it.",
      interest: "business",
      source: { url: wiki("Opportunity_cost"), publisher: "Wikipedia (reference)", publishedAt: "Long-standing economics concept", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Opportunity cost is the value of the next-best option you give up when you choose something.",
        "It applies to time and attention as well as money: an hour in one meeting is an hour not spent elsewhere.",
        "It's easy to miss because the forgone option is invisible — nothing on a receipt shows what you didn't do.",
      ],
      mainIdea: "Every choice has a hidden cost: the best alternative you gave up, which matters even though you never see it.",
      uncertainty: null,
      keyTerm: {
        term: "trade-off",
        meaning: "Giving up some of one thing to get more of another.",
        inContext: null,
        exampleUse: "The trade-off is speed: if we add the review step, we ship a day later.",
      },
      followUpQuestion: "Describe a decision at work where the opportunity cost was bigger than the visible cost.",
    },
  },
  {
    card: {
      id: "eg-planning-fallacy",
      title: "The planning fallacy",
      description: "Why projects almost always take longer than we expect — even when we know this.",
      interest: "business",
      source: { url: wiki("Planning_fallacy"), publisher: "Wikipedia (reference)", publishedAt: "Idea named 1979", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Daniel Kahneman and Amos Tversky described the planning fallacy in 1979: people underestimate how long their own tasks will take.",
        "It persists even when people know similar past tasks ran late, because they picture the best-case path for this one.",
        "A common remedy is \"reference class forecasting\": estimate from how long similar projects actually took, not from the plan.",
      ],
      mainIdea: "We underestimate our own task times because we imagine the plan going smoothly; comparing to similar past projects gives better estimates.",
      uncertainty: "The bias is well documented, but its size varies a lot by person and task, and some people overestimate short tasks.",
      keyTerm: {
        term: "base rate",
        meaning: "How often something typically happens across many similar cases.",
        inContext: null,
        exampleUse: "Before we commit to two weeks, what's the base rate for launches like this?",
      },
      followUpQuestion: "How would you push back, politely, on a deadline that seems to ignore the planning fallacy?",
    },
  },
  {
    card: {
      id: "eg-testing-effect",
      title: "Retrieval practice: testing yourself helps you remember",
      description: "Pulling information out of memory strengthens it more than rereading does.",
      interest: "science",
      source: { url: wiki("Testing_effect"), publisher: "Wikipedia (reference)", publishedAt: "Research since the early 1900s", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Many experiments find that recalling material (self-testing) leads to better long-term retention than spending the same time rereading it.",
        "In a widely cited 2006 study, Henry Roediger and Jeffrey Karpicke found rereading looked better after minutes, but self-testing won after a week.",
        "Recall often feels harder and less fluent, which is part of why people underuse it.",
      ],
      mainIdea: "Actively recalling information makes it stick better over time than rereading, even though rereading feels more effective.",
      uncertainty: "The effect is strong for remembering studied material; evidence that it transfers to complex real-world skills is more mixed.",
      keyTerm: {
        term: "retrieval practice",
        meaning: "Learning by recalling something from memory rather than reviewing it again.",
        inContext: null,
        exampleUse: "Instead of rereading my notes, I'll use retrieval practice and explain the plan from memory.",
      },
      followUpQuestion: "How could a team use retrieval practice to remember decisions from a long meeting?",
    },
  },
  {
    card: {
      id: "eg-survivorship-bias",
      title: "Survivorship bias",
      description: "Looking only at the successes that remain can teach exactly the wrong lesson.",
      interest: "science",
      source: { url: wiki("Survivorship_bias"), publisher: "Wikipedia (reference)", publishedAt: "Classic example from the 1940s", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Survivorship bias happens when we study only the cases that made it through some filter and ignore the ones that didn't.",
        "The classic story: statistician Abraham Wald, analysing damage on returning WWII aircraft, argued armor belonged where returning planes had no holes — planes hit there didn't return.",
        "Everyday version: studying only successful startups or famous dropouts hides the many who tried the same thing and failed.",
      ],
      mainIdea: "If you only look at survivors, you miss the failures that would show what really matters.",
      uncertainty: "Popular retellings of the Wald story simplify and embellish his actual analysis; the underlying statistical point is sound.",
      keyTerm: {
        term: "sample",
        meaning: "The set of cases you actually look at when drawing a conclusion.",
        inContext: null,
        exampleUse: "Our sample is only customers who stayed, so it can't tell us why people left.",
      },
      followUpQuestion: "Where might survivorship bias affect advice people give about careers?",
    },
  },
  {
    card: {
      id: "eg-moores-law",
      title: "Moore's law: an observation, not a law of nature",
      description: "A 1965 prediction about computer chips shaped an industry. Is it ending?",
      interest: "technology",
      source: { url: wiki("Moore%27s_law"), publisher: "Wikipedia (reference)", publishedAt: "Prediction from 1965", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "In 1965 Gordon Moore observed the number of components on a chip was doubling about every year; in 1975 he revised it to about every two years.",
        "The trend held for decades, partly because the industry planned around it — it worked as a target as much as a forecast.",
        "Shrinking transistors has become harder and more expensive, so gains increasingly come from chip design, packaging and specialised hardware.",
      ],
      mainIdea: "Moore's law was an observed trend in chip density that the industry helped sustain, and it is slowing as physical and cost limits grow.",
      uncertainty: "Experts disagree on whether Moore's law is \"dead\" or continuing in new forms; the answer depends on what you measure (density, cost per transistor, or performance).",
      keyTerm: {
        term: "self-fulfilling prophecy",
        meaning: "A prediction that helps cause itself to come true because people act on it.",
        inContext: null,
        exampleUse: "The roadmap became a self-fulfilling prophecy: every supplier planned around it.",
      },
      followUpQuestion: "If someone says \"Moore's law is dead\", what question would you ask to clarify what they mean?",
    },
  },
  {
    card: {
      id: "eg-regression-to-mean",
      title: "Regression to the mean",
      description: "Why extreme results are usually followed by more ordinary ones — and how that fools us.",
      interest: "health",
      source: { url: wiki("Regression_toward_the_mean"), publisher: "Wikipedia (reference)", publishedAt: "Described by Francis Galton, 1880s", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "When a measurement is unusually high or low partly by chance, the next measurement tends to be closer to average.",
        "People often seek treatment when symptoms are at their worst, so many would improve somewhat anyway — making any remedy look effective.",
        "This is one reason medical trials compare against a control group instead of just measuring before and after.",
      ],
      mainIdea: "Extreme results tend to be followed by less extreme ones by chance, so improvement after an intervention isn't proof the intervention worked.",
      uncertainty: null,
      keyTerm: {
        term: "control group",
        meaning: "A comparison group that doesn't receive the change, used to see what would have happened anyway.",
        inContext: null,
        exampleUse: "Sales went up after the redesign, but without a control group we can't tell if the redesign caused it.",
      },
      followUpQuestion: "A manager says a training worked because the lowest performers improved afterwards. What would you point out?",
    },
  },
  {
    card: {
      id: "eg-urban-heat-island",
      title: "Urban heat islands",
      description: "Cities can be noticeably hotter than their surroundings — and some fixes are simple.",
      interest: "environment",
      source: { url: "https://www.epa.gov/heatislands", publisher: "U.S. Environmental Protection Agency", publishedAt: "Reference page (ongoing)", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Built-up areas with lots of pavement, dark roofs and few trees absorb and re-release heat, so they can be several degrees warmer than nearby rural areas.",
        "The difference is often largest at night, when stored heat is released, which matters for health during heat waves.",
        "Common responses include planting trees, reflective \"cool\" roofs and pavements, and green spaces.",
      ],
      mainIdea: "Cities trap heat because of their surfaces and lack of shade, and changes like trees and reflective roofs can reduce it.",
      uncertainty: "How much each fix helps depends heavily on local climate and design; measured benefits vary between cities.",
      keyTerm: {
        term: "mitigation",
        meaning: "Action that reduces how severe a problem is.",
        inContext: null,
        exampleUse: "Shade trees are a low-cost mitigation for hot playgrounds.",
      },
      followUpQuestion: "If you had to convince a city council to fund street trees, what's your one-sentence request?",
    },
  },
  {
    card: {
      id: "eg-dunbar",
      title: "Dunbar's number: are we limited to 150 relationships?",
      description: "A popular claim about friendship limits — and why researchers dispute it.",
      interest: "culture",
      source: { url: wiki("Dunbar%27s_number"), publisher: "Wikipedia (reference)", publishedAt: "Proposed in the 1990s", retrievedAt: EVERGREEN_REVIEWED_AT },
    },
    briefing: {
      points: [
        "Anthropologist Robin Dunbar proposed in the 1990s that humans can maintain roughly 150 stable relationships, based on brain size in primates.",
        "The number became popular in business: some companies cap team or site size around it.",
        "A 2021 reanalysis using similar methods found the estimate is very uncertain, with plausible values ranging widely; Dunbar and colleagues have disputed that critique.",
      ],
      mainIdea: "Dunbar's number suggests a limit of about 150 stable relationships, but the evidence is contested and the exact figure is uncertain.",
      uncertainty: "This is an active disagreement: supporters point to consistent group sizes in many settings; critics argue the statistical basis is too weak for a single number.",
      keyTerm: {
        term: "contested",
        meaning: "Actively disputed by people with relevant expertise.",
        inContext: null,
        exampleUse: "The 150 figure is contested, so I'd treat it as a rough idea, not a rule.",
      },
      followUpQuestion: "Should a company use Dunbar's number when deciding team sizes? Give your view and one reason.",
    },
  },
];

function hashString(s: string): string {
  // Small deterministic non-cryptographic hash (FNV-1a), adequate for change detection.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function stableHash(s: string): string {
  return hashString(s);
}

export function evergreenCards(): StoryCard[] {
  return ENTRIES.map((e) => ({
    ...e.card,
    kind: "evergreen" as const,
    estimatedMinutes: e.card.estimatedMinutes ?? 4,
    whySelected: "",
    briefingReady: true,
  }));
}

export function evergreenBriefing(id: string): Briefing | null {
  const e = ENTRIES.find((x) => x.card.id === id);
  if (!e) return null;
  return {
    storyId: e.card.id,
    kind: "evergreen",
    title: e.card.title,
    source: e.card.source,
    coverage: "curated",
    generatedBy: "curated",
    generatedAt: EVERGREEN_REVIEWED_AT,
    supportingExcerpts: [],
    sourceVersion: hashString(JSON.stringify(e.briefing)),
    ...e.briefing,
  };
}

export const ALL_INTERESTS: { id: Interest; label: string }[] = [
  { id: "technology", label: "Technology" },
  { id: "science", label: "Science" },
  { id: "business", label: "Business & work" },
  { id: "health", label: "Health" },
  { id: "environment", label: "Environment" },
  { id: "culture", label: "Culture & communication" },
];
