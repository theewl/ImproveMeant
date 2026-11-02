import type { FeedKind, Interest, SourceMeta, StoryCard } from "../../shared/types";

/** Source text we are permitted to process, plus provenance. */
export interface SourceDocument {
  storyId: string;
  title: string;
  text: string;
  /** True when we only used the first part of the text (bounded input). */
  partial: boolean;
  source: SourceMeta;
  /** Provider revision identifier (e.g. Wikipedia revision id). */
  revision: string;
  license: string;
}

export interface LiveCandidate {
  storyId: string;
  feed: FeedKind;
  title: string;
  blurb: string;
  description: string;
  interest: Interest | null;
  pageTitle: string;
  url: string;
  revision: string;
  sourceUpdatedAt?: string;
  featuredOn: string; // ISO date the provider featured it
}

export interface TopicHit {
  title: string;
  pageid: number;
  snippet: string;
}

export interface ContentProvider {
  readonly name: string;
  listCandidates(dateIso: string): Promise<LiveCandidate[]>;
  fetchDocument(c: LiveCandidate, maxChars: number): Promise<SourceDocument>;
  /** Find articles for a topic the learner typed. */
  searchTopics(query: string): Promise<TopicHit[]>;
  /** Build a candidate for one chosen article. */
  lookup(pageid: number): Promise<LiveCandidate | null>;
}

export type { StoryCard };
