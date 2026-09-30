/**
 * OpenAIProvider — real LLM calls against any OpenAI-compatible endpoint.
 *
 * Configured with OPENAI_BASE_URL and OPENAI_API_KEY, so it works with OpenAI,
 * OpenRouter, Groq, a local Ollama, or the omniroute proxy used in development.
 *
 * Responsibilities and non-responsibilities:
 *   DOES:    extract structured data from a CV, analyze a job description,
 *            write assistant wording, embed text.
 *   DOES NOT: compute alignment, gaps, priorities, or any other score. Those
 *            come from services/engine. A test asserts the model is never asked
 *            for a score.
 */

import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { estimateCostUsd } from './cache.js';
import { KNOWN_SKILL_ALIASES } from './demoKnowledge.js';
import type {
  AIProvider,
  AssistantAnswer,
  AssistantContext,
  CvExtractionResult,
  ExtractedItem,
  ExtractedItemType,
  JobDescriptionAnalysis,
  NormalizationResult,
  SimilarityResult,
} from './types.js';
import { SIMILARITY_THRESHOLD } from '@skillmap/shared';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

interface EmbeddingResponse {
  data?: { embedding?: number[] }[];
  usage?: { prompt_tokens?: number };
  error?: { message?: string };
}

const EXTRACTION_SCHEMA_HINT = `Return ONLY a JSON array. Each element must have:
- "type": one of skill|education|project|certification|experience|tool|language|soft_skill
- "rawValue": the exact text you saw in the document
- "normalizedSkillName": the canonical skill name if you recognise it, otherwise null
- "suggestedLevel": an integer 0-5 only when the document clearly shows depth, otherwise null
- "confidence": a number between 0 and 1
- "context": a short quote from the document that supports the item

Rules you must follow:
- Never invent a skill that is not in the document.
- Never output a salary, a job guarantee, or an employment probability.
- Never infer age, gender, religion, or any protected attribute.
- If you are unsure, still include the item but set confidence below 0.7.`;

export class OpenAIProvider implements AIProvider {
  readonly mode = 'openai' as const;
  readonly usesRealLlm = true;
  readonly usesLocalEmbeddings = false;
  readonly deterministic = false;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly extractionModel: string;
  private readonly chatModel: string;
  private readonly timeoutMs = 30_000;

  constructor() {
    this.baseUrl = (config.ai.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = config.ai.apiKey;
    this.extractionModel = config.ai.extractionModel || 'gpt-4o-mini';
    this.chatModel = config.ai.chatModel || 'gpt-4o-mini';
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      return response.ok;
    } catch (error) {
      logger.warn('OpenAI availability check failed', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      return false;
    }
  }

  private async chat(
    messages: ChatMessage[],
    model: string,
    options: { json?: boolean; temperature?: number; maxTokens?: number } = {},
  ): Promise<{ content: string; inputTokens: number; outputTokens: number; costUsd: number }> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 2000,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(
        `AI provider returned ${response.status}: ${body.error?.message ?? 'unknown error'}`,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content ?? '';
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      content,
      inputTokens,
      outputTokens,
      costUsd: estimateCostUsd(model, inputTokens, outputTokens),
    };
  }

  async extractFromCv(text: string): Promise<CvExtractionResult> {
    // Long CVs are truncated from the middle: the header carries contact and
    // education, the tail carries the most recent experience.
    const truncated =
      text.length > 24_000
        ? `${text.slice(0, 14_000)}\n\n[...middle omitted for length...]\n\n${text.slice(-8_000)}`
        : text;

    const result = await this.chat(
      [
        {
          role: 'system',
          content: `You extract structured data from resumes and CVs. ${EXTRACTION_SCHEMA_HINT}`,
        },
        {
          role: 'user',
          content: `Extract every skill, tool, project, certification, and education entry from this CV.\n\nCV:\n${truncated}`,
        },
      ],
      this.extractionModel,
      { json: true, temperature: 0.05, maxTokens: 3000 },
    );

    return {
      items: this.parseExtraction(result.content),
      mode: this.mode,
      model: this.extractionModel,
      notice: null,
    };
  }

  private parseExtraction(content: string): ExtractedItem[] {
    const validTypes: ExtractedItemType[] = [
      'skill',
      'education',
      'project',
      'certification',
      'experience',
      'tool',
      'language',
      'soft_skill',
    ];

    let parsed: unknown;
    try {
      const trimmed = content.trim();
      const jsonText = trimmed.startsWith('[')
        ? trimmed
        : (trimmed.match(/\[[\s\S]*\]/)?.[0] ?? trimmed);
      parsed = JSON.parse(jsonText);
    } catch (error) {
      throw new Error(
        `AI extraction returned invalid JSON: ${error instanceof Error ? error.message : 'parse failure'}`,
      );
    }

    if (!Array.isArray(parsed)) {
      throw new Error('AI extraction did not return an array');
    }

    return parsed
      .filter((raw): raw is Record<string, unknown> => typeof raw === 'object' && raw !== null)
      .map((raw): ExtractedItem => {
        const type = validTypes.includes(raw['type'] as ExtractedItemType)
          ? (raw['type'] as ExtractedItemType)
          : 'skill';
        const confidenceRaw = Number(raw['confidence']);
        const confidence = Number.isFinite(confidenceRaw)
          ? Math.min(1, Math.max(0, confidenceRaw))
          : 0.5;
        const levelRaw = Number(raw['suggestedLevel']);

        return {
          type,
          rawValue: String(raw['rawValue'] ?? '').slice(0, 300),
          normalizedSkillName:
            typeof raw['normalizedSkillName'] === 'string' ? raw['normalizedSkillName'] : null,
          suggestedLevel:
            Number.isInteger(levelRaw) && levelRaw >= 0 && levelRaw <= 5 ? levelRaw : null,
          confidence,
          context: typeof raw['context'] === 'string' ? raw['context'].slice(0, 300) : null,
        };
      })
      .filter((item) => item.rawValue.trim().length > 0);
  }

  async normalizeSkillName(rawName: string): Promise<NormalizationResult> {
    // Alias resolution is a table lookup, not a model call. Cheaper, faster,
    // and always the same answer. The model is only asked when the table misses.
    const key = rawName.trim().toLowerCase();
    for (const [canonical, aliases] of KNOWN_SKILL_ALIASES) {
      if (canonical.toLowerCase() === key) {
        return { canonical, matchedBy: 'exact', confidence: 0.95, matchedSkillId: null };
      }
      if (aliases.some((a) => a.toLowerCase() === key)) {
        return { canonical, matchedBy: 'alias', confidence: 0.88, matchedSkillId: null };
      }
    }

    const embedding = await this.embed(rawName);
    if (embedding) {
      const { models } = await import('../models/index.js');
      const candidates = (await models.Skill.find({ embedding: { $ne: null }, isPublished: true })
        .select('name embedding')
        .limit(200)
        .lean()) as { name: string; embedding: number[] }[];

      let best: { name: string; similarity: number } | null = null;
      for (const candidate of candidates) {
        const similarity = cosineSimilarity(embedding, candidate.embedding);
        if (!best || similarity > best.similarity) best = { name: candidate.name, similarity };
      }

      if (best && best.similarity >= SIMILARITY_THRESHOLD) {
        return {
          canonical: best.name,
          matchedBy: 'embedding',
          confidence: best.similarity,
          matchedSkillId: null,
        };
      }
    }

    return { canonical: rawName.trim(), matchedBy: 'none', confidence: 0, matchedSkillId: null };
  }

  async embed(text: string): Promise<number[] | null> {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) return null;
      const data = (await response.json()) as EmbeddingResponse;
      return data.data?.[0]?.embedding ?? null;
    } catch (error) {
      logger.warn('Embedding call failed, continuing without it', {
        message: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  async similarity(a: string, b: string, sameCategory: boolean): Promise<SimilarityResult> {
    const [embeddingA, embeddingB] = await Promise.all([this.embed(a), this.embed(b)]);

    const similarity =
      embeddingA && embeddingB ? cosineSimilarity(embeddingA, embeddingB) : tokenOverlap(a, b);

    const passesThreshold = similarity >= SIMILARITY_THRESHOLD;
    return {
      similarity,
      passesThreshold,
      sameCategory,
      eligibleForCredit: passesThreshold && sameCategory,
    };
  }

  async analyzeJobDescription(text: string): Promise<JobDescriptionAnalysis> {
    const result = await this.chat(
      [
        {
          role: 'system',
          content: `You analyze job descriptions. ${EXTRACTION_SCHEMA_HINT}
Also return a "seniorityHint" of junior|mid|senior|unknown and a "suggestedCareer" object with slug, name, and a one-sentence reason, or null.
You must never output a salary figure, a hiring probability, or a job guarantee.`,
        },
        { role: 'user', content: text.slice(0, 15_000) },
      ],
      this.extractionModel,
      { json: true, temperature: 0.05, maxTokens: 2000 },
    );

    try {
      const parsed = JSON.parse(result.content.trim()) as {
        items?: unknown[];
        detectedSkills?: { name?: string; confidence?: number }[];
        seniorityHint?: string;
        suggestedCareer?: { slug?: string; name?: string; reason?: string } | null;
      };

      const detectedSkills = (parsed.detectedSkills ?? []).map((s) => ({
        name: String(s.name ?? '').slice(0, 120),
        confidence: Math.min(1, Math.max(0, Number(s.confidence ?? 0.5))),
      }));

      return {
        detectedSkills,
        suggestedCareer: parsed.suggestedCareer?.slug
          ? {
              slug: String(parsed.suggestedCareer.slug),
              name: String(parsed.suggestedCareer.name ?? ''),
              reason: String(parsed.suggestedCareer.reason ?? ''),
            }
          : null,
        seniorityHint:
          parsed.seniorityHint === 'junior' ||
          parsed.seniorityHint === 'mid' ||
          parsed.seniorityHint === 'senior'
            ? parsed.seniorityHint
            : 'unknown',
        mode: this.mode,
        notice: null,
      };
    } catch (error) {
      throw new Error(
        `Job description analysis returned invalid JSON: ${error instanceof Error ? error.message : 'parse failure'}`,
      );
    }
  }

  async answerAssistant(question: string, context: AssistantContext): Promise<AssistantAnswer> {
    const result = await this.chat(
      [
        {
          role: 'system',
          content: `You are the SkillMap career assistant for university students and fresh graduates in Bangladesh.

Absolute rules:
- Answer ONLY from the student data provided. Never invent skills, employers, resources, or statistics.
- Never state or imply a job guarantee, a salary figure, or an employment probability.
- Never infer age, gender, religion, or any protected attribute, and never let such an attribute affect advice.
- If asked something outside skills, careers, and learning, say so politely and redirect.
- Be encouraging but honest. Never shame the student for a gap.
- Keep answers under 150 words.`,
        },
        {
          role: 'user',
          content: `Student: ${context.studentName}
Target career: ${context.targetCareerName ?? 'not chosen yet'}
Current alignment: ${context.alignmentPercent === null ? 'unknown' : `${context.alignmentPercent}%`}
Top gaps: ${context.topGaps.map((g) => `${g.skillName} (gap ${g.gap}, ${g.importance} importance)`).join('; ') || 'none recorded'}
Top priorities: ${context.topPriorities.map((p) => `${p.skillName}: ${p.reason}`).join(' | ') || 'none yet'}
Skills they already have: ${context.ownedSkills.join(', ') || 'none recorded'}
Weekly study hours: ${context.weeklyStudyHours}
Page they are on: ${context.pageContext ?? 'unknown'}

Student question: ${question}

Respond with JSON: {"answer": string, "sourceTags": [{"tag": "profile"|"career_database"|"ai_suggestion", "reason": string}], "suggestedChips": string[]}`,
        },
      ],
      this.chatModel,
      { json: true, temperature: 0.3, maxTokens: 800 },
    );

    try {
      const parsed = JSON.parse(result.content.trim()) as {
        answer?: string;
        sourceTags?: { tag?: string; reason?: string }[];
        suggestedChips?: string[];
      };

      return {
        answer: String(parsed.answer ?? '').trim(),
        sourceTags: (parsed.sourceTags ?? [])
          .filter((t) => ['profile', 'career_database', 'ai_suggestion'].includes(String(t.tag)))
          .map((t) => ({
            tag: t.tag as 'profile' | 'career_database' | 'ai_suggestion',
            reason: String(t.reason ?? '').slice(0, 200),
          })),
        suggestedChips: (parsed.suggestedChips ?? [])
          .slice(0, 4)
          .map((c) => String(c).slice(0, 80)),
        mode: this.mode,
        model: this.chatModel,
        notice: null,
      };
    } catch (error) {
      throw new Error(
        `Assistant returned invalid JSON: ${error instanceof Error ? error.message : 'parse failure'}`,
      );
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  if (length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Token-overlap fallback used when embeddings are unavailable. */
function tokenOverlap(a: string, b: string): number {
  const tokenA = new Set(
    a
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter(Boolean),
  );
  const tokenB = new Set(
    b
      .toLowerCase()
      .split(/[^a-z0-9+#]+/)
      .filter(Boolean),
  );
  if (tokenA.size === 0 || tokenB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokenA) if (tokenB.has(token)) intersection += 1;
  const union = tokenA.size + tokenB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function createOpenAIProvider(): OpenAIProvider {
  return new OpenAIProvider();
}
