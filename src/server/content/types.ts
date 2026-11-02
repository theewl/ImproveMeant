import type { Interest, SourceMeta, StoryCard } from "../../shared/types";

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

export interface ContentProvider {
  readonly name: string;
  listCandidates(dateIso: string): Promise<LiveCandidate[]>;
  fetchDocument(c: LiveCandidate, maxChars: number): Promise<SourceDocument>;
}

export type { StoryCard };
