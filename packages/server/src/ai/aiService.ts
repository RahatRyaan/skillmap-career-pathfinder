/**
 * AIService — the only entry point controllers may use for AI.
 *
 * Responsibilities:
 *   - Select the provider for the configured AI_MODE
 *   - Cache by input hash
 *   - Enforce the budget ceiling
 *   - Fall back to DemoProvider with a VISIBLE notice when a real provider fails
 *   - Run every outbound string through the safety filter
 *
 * Controllers never import a provider directly. See .kilo/rules/sm-ai-safety.md
 */

import type { AIMode } from '@skillmap/shared';
import { PROHIBITED_AI_PHRASES } from '@skillmap/shared';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { budget, recordAiInteraction, withAiCache } from './cache.js';
import { DemoProvider } from './demoProvider.js';
import { OpenAIProvider } from './openaiProvider.js';
import type {
  AIProvider,
  AssistantAnswer,
  AssistantContext,
  CvExtractionResult,
  JobDescriptionAnalysis,
  NormalizationResult,
  SimilarityResult,
} from './types.js';
import { AI_MODE_DESCRIPTIONS } from './types.js';

let provider: AIProvider | null = null;
let activeMode: AIMode = config.ai.mode;

export function getProvider(): AIProvider {
  if (provider) return provider;

  if (config.ai.mode === 'openai') {
    provider = new OpenAIProvider();
  } else {
    provider = new DemoProvider();
  }
  return provider;
}

/** Effective mode, which may differ from config after a runtime fallback. */
export function getActiveMode(): AIMode {
  return activeMode;
}

export function setActiveMode(mode: AIMode): void {
  activeMode = mode;
}

export function getModeInfo(): {
  mode: AIMode;
  available: boolean;
  description: string;
  usesRealLlm: boolean;
  usesLocalEmbeddings: boolean;
  deterministic: boolean;
  notice: string | null;
  spentUsd: number;
  budgetUsd: number;
} {
  const p = getProvider();
  return {
    mode: activeMode,
    available: true,
    description: AI_MODE_DESCRIPTIONS[activeMode].description,
    usesRealLlm: p.usesRealLlm,
    usesLocalEmbeddings: p.usesLocalEmbeddings,
    deterministic: p.deterministic,
    notice:
      activeMode === config.ai.mode
        ? AI_MODE_DESCRIPTIONS[activeMode].notice
        : `The configured AI provider is unavailable, so SkillMap fell back to Demo Mode. ${AI_MODE_DESCRIPTIONS.demo.notice}`,
    spentUsd: Math.round(budget.spent * 10_000) / 10_000,
    budgetUsd: budget.limit,
  };
}

/**
 * Scan outbound AI text for the claims the product must never make.
 * Returns a notice when something was replaced, so the UI can show it.
 */
export function enforceAiSafety(text: string): { text: string; notice: string | null } {
  let sanitized = text;
  let blocked = 0;

  for (const pattern of PROHIBITED_AI_PHRASES) {
    if (pattern.test(sanitized)) {
      blocked += 1;
      sanitized = sanitized.replace(pattern, 'a specific figure I cannot verify');
    }
  }

  if (blocked === 0) return { text: sanitized, notice: null };

  return {
    text: sanitized,
    notice:
      'Part of this answer mentioned a job outcome or a salary figure, which SkillMap does not report. That part was removed.',
  };
}

/**
 * Run an operation against the configured provider, falling back to demo mode
 * on failure. The fallback is never silent: the caller receives a notice.
 */
async function withFallback<T>(
  kind: string,
  userId: string | null | undefined,
  operation: (p: AIProvider) => Promise<{ value: T; notice: string | null; model: string | null }>,
): Promise<{ value: T; mode: AIMode; notice: string | null; usedFallback: boolean }> {
  const primary = getProvider();

  if (primary.usesRealLlm && budget.exhausted) {
    logger.warn('AI budget exhausted, using demo provider', { kind, spent: budget.spent });
    const demo = new DemoProvider();
    const result = await operation(demo);
    return {
      value: result.value,
      mode: 'demo',
      notice:
        'The AI usage budget for this server was reached, so this answer used Demo Mode instead.',
      usedFallback: true,
    };
  }

  try {
    const result = await operation(primary);
    return {
      value: result.value,
      mode: primary.mode,
      notice: result.notice,
      usedFallback: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('AI provider failed, falling back to demo mode', {
      kind,
      mode: primary.mode,
      message: message.slice(0, 200),
    });

    await recordAiInteraction({
      userId,
      kind,
      mode: primary.mode,
      model: null,
      success: false,
      notice: message.slice(0, 200),
    });

    if (!primary.usesRealLlm) throw error;

    const demo = new DemoProvider();
    const result = await operation(demo);
    return {
      value: result.value,
      mode: 'demo',
      notice: `The AI service did not respond, so SkillMap answered using Demo Mode instead. ${AI_MODE_DESCRIPTIONS.demo.notice}`,
      usedFallback: true,
    };
  }
}

export async function extractCvSkills(
  text: string,
  userId?: string | null,
): Promise<CvExtractionResult> {
  const outcome = await withFallback('cv_extraction', userId, async (p) => {
    const cached = await withAiCache('cv_extraction', p.mode, text, async () => {
      const result = await p.extractFromCv(text);
      return {
        value: result,
        tokensUsed: Math.ceil(text.length / 4),
        estimatedCostUsd: 0,
        model: result.model,
      };
    });
    return { value: cached.value, notice: cached.value.notice, model: cached.value.model };
  });

  return {
    ...outcome.value,
    mode: outcome.mode,
    notice: outcome.notice,
  };
}

export async function normalizeSkill(rawName: string): Promise<NormalizationResult> {
  const result = await getProvider().normalizeSkillName(rawName);
  return result;
}

export async function compareSkillSimilarity(
  a: string,
  b: string,
  sameCategory: boolean,
): Promise<SimilarityResult> {
  return getProvider().similarity(a, b, sameCategory);
}

export async function analyzeJobDescription(
  text: string,
  userId?: string | null,
): Promise<JobDescriptionAnalysis> {
  const outcome = await withFallback('job_description_analysis', userId, async (p) => {
    const result = await p.analyzeJobDescription(text);
    return { value: result, notice: result.notice, model: null };
  });

  return { ...outcome.value, mode: outcome.mode, notice: outcome.notice };
}

export async function askAssistant(
  question: string,
  context: AssistantContext,
  userId?: string | null,
): Promise<AssistantAnswer> {
  const outcome = await withFallback('assistant_chat', userId, async (p) => {
    const result = await p.answerAssistant(question, context);
    const safety = enforceAiSafety(result.answer);
    return {
      value: { ...result, answer: safety.text, notice: safety.notice ?? result.notice },
      notice: safety.notice ?? result.notice,
      model: result.model,
    };
  });

  return { ...outcome.value, mode: outcome.mode, notice: outcome.notice };
}

/** Startup self-test. Never throws. */
export async function checkAiHealth(): Promise<{
  mode: AIMode;
  available: boolean;
  notice: string | null;
}> {
  try {
    const available = await getProvider().isAvailable();
    if (!available && getProvider().usesRealLlm) {
      return {
        mode: 'demo',
        available: false,
        notice:
          'The configured AI provider is not reachable. SkillMap will use Demo Mode until it recovers.',
      };
    }
    return { mode: getProvider().mode, available, notice: null };
  } catch (error) {
    return {
      mode: 'demo',
      available: false,
      notice: `AI health check failed: ${error instanceof Error ? error.message : 'unknown error'}. Demo Mode is active.`,
    };
  }
}

/** Test seam. */
export function resetProvider(): void {
  provider = null;
  activeMode = config.ai.mode;
}
