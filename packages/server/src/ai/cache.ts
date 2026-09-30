/**
 * Cache and cost control for AI calls.
 *
 * Two controls, both from the spec:
 *   1. Embeddings are cached on the skill document itself.
 *   2. AI responses are cached by a hash of (kind + mode + input).
 *
 * Plus a hard USD ceiling per process so a bug cannot run up a bill.
 */

import { createHash } from 'node:crypto';
import { config } from '../config/env.js';
import { models } from '../models/index.js';
import { logger } from '../utils/logger.js';

const inFlight = new Map<string, Promise<unknown>>();

export function hashInput(kind: string, mode: string, input: string): string {
  return createHash('sha256').update(`${kind}:${mode}:${input}`).digest('hex');
}

export interface CacheRecord<T> {
  value: T;
  hit: boolean;
  tokensUsed: number;
  estimatedCostUsd: number;
}

/** Rough USD per 1M tokens, by model family. Used only for the budget cap. */
function pricePerMillion(model: string): { input: number; output: number } {
  const m = model.toLowerCase();
  if (m.includes('gpt-4o-mini') || m.includes('mini')) return { input: 0.15, output: 0.6 };
  if (m.includes('gpt-4o')) return { input: 2.5, output: 10 };
  if (m.includes('gpt-4')) return { input: 30, output: 60 };
  if (m.includes('gpt-3.5')) return { input: 0.5, output: 1.5 };
  if (m.includes('cheap') || m.includes('flash') || m.includes('fast')) {
    return { input: 0.1, output: 0.4 };
  }
  return { input: 1, output: 3 };
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = pricePerMillion(model);
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
}

class BudgetGuard {
  private spentUsd = 0;

  get spent(): number {
    return this.spentUsd;
  }

  get limit(): number {
    return config.ai.budgetUsd;
  }

  get exhausted(): boolean {
    return this.limit > 0 && this.spentUsd >= this.limit;
  }

  remaining(): number {
    if (this.limit <= 0) return Number.POSITIVE_INFINITY;
    return Math.max(0, this.limit - this.spentUsd);
  }

  charge(usd: number): void {
    this.spentUsd += usd;
    if (this.limit > 0 && this.spentUsd >= this.limit) {
      logger.warn('AI budget ceiling reached', { spentUsd: this.spentUsd, limit: this.limit });
    }
  }

  reset(): void {
    this.spentUsd = 0;
  }
}

export const budget = new BudgetGuard();

/**
 * Read-through cache. Also collapses concurrent identical calls into one
 * in-flight request, so ten simultaneous identical CV extractions cost one call.
 */
export async function withAiCache<T>(
  kind: string,
  mode: string,
  input: string,
  compute: () => Promise<{
    value: T;
    tokensUsed: number;
    estimatedCostUsd: number;
    model: string | null;
  }>,
): Promise<CacheRecord<T>> {
  const inputHash = hashInput(kind, mode, input);

  try {
    const cached = (await models.AIInteraction.findOne({
      inputHash,
      kind,
      mode,
      success: true,
    })
      .sort({ createdAt: -1 })
      .lean()) as { result?: T } | null;

    if (cached && cached.result !== undefined) {
      return {
        value: cached.result as T,
        hit: true,
        tokensUsed: 0,
        estimatedCostUsd: 0,
      };
    }
  } catch (error) {
    // A cache read failure must never break the request.
    logger.warn('AI cache read failed', {
      kind,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  const flightKey = `${kind}:${inputHash}`;
  const existing = inFlight.get(flightKey);
  if (existing) return existing as Promise<CacheRecord<T>>;

  const promise = (async (): Promise<CacheRecord<T>> => {
    const started = Date.now();
    const result = await compute();

    budget.charge(result.estimatedCostUsd);

    try {
      await models.AIInteraction.create({
        kind,
        mode,
        model: result.model,
        inputHash,
        tokensUsed: result.tokensUsed,
        estimatedCostUsd: result.estimatedCostUsd,
        latencyMs: Date.now() - started,
        cacheHit: false,
        success: true,
        result: result.value,
      });
    } catch (error) {
      logger.warn('AI cache write failed', {
        kind,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }

    return {
      value: result.value,
      hit: false,
      tokensUsed: result.tokensUsed,
      estimatedCostUsd: result.estimatedCostUsd,
    };
  })().finally(() => inFlight.delete(flightKey));

  inFlight.set(flightKey, promise);
  return promise as Promise<CacheRecord<T>>;
}

/** Log an AI interaction that produced no cacheable value. */
export async function recordAiInteraction(input: {
  userId?: string | null;
  kind: string;
  mode: string;
  model: string | null;
  tokensUsed?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  success: boolean;
  notice?: string | null;
}): Promise<void> {
  try {
    await models.AIInteraction.create({
      userId: input.userId ?? null,
      kind: input.kind,
      mode: input.mode,
      model: input.model,
      inputHash: hashInput(input.kind, input.mode, `log:${Date.now()}:${Math.random()}`),
      tokensUsed: input.tokensUsed ?? 0,
      estimatedCostUsd: input.estimatedCostUsd ?? 0,
      latencyMs: input.latencyMs ?? 0,
      cacheHit: false,
      success: input.success,
      notice: input.notice ?? null,
    });
  } catch (error) {
    logger.warn('Failed to record AI interaction', {
      kind: input.kind,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}
