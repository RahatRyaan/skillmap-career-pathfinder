/**
 * AI provider interface.
 *
 * Three implementations satisfy this contract: OpenAI (real LLM), local
 * (Transformers.js embeddings, free), and demo (deterministic templates).
 *
 * The whole point of this seam is that the three modes are interchangeable. The
 * server test suite runs the SAME contract test against all of them, so a
 * change that breaks demo mode cannot ship.
 *
 * A provider is FORBIDDEN from computing a score. Alignment, gaps, and
 * priorities come from services/engine. AI supplies extraction and wording.
 */

import type { AIMode, AISourceTag } from '@skillmap/shared';

// ─── Extraction ─────────────────────────────────────────────────────────────

export type ExtractedItemType =
  | 'skill'
  | 'education'
  | 'project'
  | 'certification'
  | 'experience'
  | 'tool'
  | 'language'
  | 'soft_skill';

export interface ExtractedItem {
  type: ExtractedItemType;
  rawValue: string;
  /** Canonical skill name when the item maps to the skill library. */
  normalizedSkillName: string | null;
  suggestedLevel: number | null;
  confidence: number;
  context: string | null;
}

export interface CvExtractionResult {
  items: ExtractedItem[];
  mode: AIMode;
  model: string | null;
  notice: string | null;
}

// ─── Normalization ──────────────────────────────────────────────────────────

export interface NormalizationResult {
  canonical: string;
  matchedBy: 'exact' | 'alias' | 'embedding' | 'none';
  confidence: number;
  matchedSkillId: string | null;
}

// ─── Similarity ─────────────────────────────────────────────────────────────

export interface SimilarityResult {
  similarity: number;
  passesThreshold: boolean;
  sameCategory: boolean;
  eligibleForCredit: boolean;
}

// ─── Job description ────────────────────────────────────────────────────────

export interface JobDescriptionAnalysis {
  detectedSkills: { name: string; confidence: number }[];
  suggestedCareer: { slug: string; name: string; reason: string } | null;
  seniorityHint: 'junior' | 'mid' | 'senior' | 'unknown';
  mode: AIMode;
  notice: string | null;
}

// ─── Assistant ──────────────────────────────────────────────────────────────

export interface AssistantContext {
  studentName: string;
  targetCareerName: string | null;
  alignmentPercent: number | null;
  topGaps: { skillName: string; gap: number; importance: string }[];
  topPriorities: { skillName: string; reason: string }[];
  ownedSkills: string[];
  weeklyStudyHours: number;
  pageContext?: string;
}

export interface AssistantAnswer {
  answer: string;
  sourceTags: { tag: AISourceTag; reason: string }[];
  suggestedChips: string[];
  mode: AIMode;
  model: string | null;
  notice: string | null;
}

// ─── Embeddings ─────────────────────────────────────────────────────────────

export interface AIProvider {
  readonly mode: AIMode;
  readonly usesRealLlm: boolean;
  readonly usesLocalEmbeddings: boolean;
  readonly deterministic: boolean;

  /** Cheap startup check. Must not throw; return false instead. */
  isAvailable(): Promise<boolean>;

  extractFromCv(text: string, hint?: string): Promise<CvExtractionResult>;
  normalizeSkillName(rawName: string): Promise<NormalizationResult>;
  embed(text: string): Promise<number[] | null>;
  /**
   * Semantic similarity between two skill names, plus whether the pair is
   * allowed to grant transferable credit. Every mode implements this so the
   * gap engine behaves identically regardless of AI configuration.
   */
  similarity(a: string, b: string, sameCategory: boolean): Promise<SimilarityResult>;
  analyzeJobDescription(text: string): Promise<JobDescriptionAnalysis>;
  answerAssistant(question: string, context: AssistantContext): Promise<AssistantAnswer>;
}

export const AI_MODE_DESCRIPTIONS: Record<AIMode, { description: string; notice: string | null }> =
  {
    demo: {
      description:
        'Demo Mode uses deterministic rules and templates. No language model is called. The same input always produces the same output, and results are labelled as sample data.',
      notice: 'Demo Mode is active. AI results here are produced by rules, not by a trained model.',
    },
    local: {
      description:
        'Local Mode uses a small sentence-embedding model that runs on this machine. Skill similarity and CV keyword matching work without any external API. Freeform assistant answers use templates.',
      notice:
        'Local Mode is active. Embeddings run on this machine; assistant answers use templates.',
    },
    openai: {
      description:
        'Real AI Mode calls an external language model for CV extraction, job-description analysis, and assistant wording. Every call is logged with its mode and cost, and results are cached by input hash.',
      notice: null,
    },
  };
