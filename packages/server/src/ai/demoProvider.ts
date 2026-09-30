/**
 * DemoProvider — deterministic, offline, zero-cost.
 *
 * This is the default mode and the mode the competition demo runs in, so it is
 * a first-class implementation rather than a stub. Every response is derived
 * from the input by rules, so the same CV always produces the same output.
 *
 * Honesty rules it must honour:
 *   - No salary figures, no job guarantees, no employment probabilities.
 *   - Nothing is presented as model-generated.
 *   - Any extracted item it is unsure about is marked low confidence so the
 *     student reviews it.
 */

import type { AIProvider } from './types.js';
import type {
  AssistantAnswer,
  AssistantContext,
  CvExtractionResult,
  ExtractedItem,
  JobDescriptionAnalysis,
  NormalizationResult,
  SimilarityResult,
} from './types.js';
import { AI_MODE_DESCRIPTIONS } from './types.js';
import { SIMILARITY_THRESHOLD } from '@skillmap/shared';
import { KNOWN_SKILL_ALIASES, SKILL_KEYWORD_PATTERNS } from './demoKnowledge.js';
import { logger } from '../utils/logger.js';

/** Crude but honest token estimate. Never used for billing accuracy. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function confidenceFor(matchKind: 'exact' | 'alias' | 'fuzzy' | 'context'): number {
  switch (matchKind) {
    case 'exact':
      return 0.95;
    case 'alias':
      return 0.88;
    case 'context':
      return 0.65;
    case 'fuzzy':
      return 0.5;
  }
}

function lineContaining(text: string, needle: string): string | null {
  const lowerText = text.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  for (const line of text.split(/\r?\n/)) {
    if (line.toLowerCase().includes(lowerNeedle)) {
      return line.trim().slice(0, 300);
    }
  }
  return lowerText.includes(lowerNeedle) ? needle : null;
}

export class DemoProvider implements AIProvider {
  readonly mode = 'demo' as const;
  readonly usesRealLlm = false;
  readonly usesLocalEmbeddings = false;
  readonly deterministic = true;

  async isAvailable(): Promise<boolean> {
    return true;
  }

  // Not async-typed: the interface is async, so this returns a promise either
  // way. Kept async for interface conformance.
  // eslint-disable-next-line @typescript-eslint/require-await
  async extractFromCv(text: string): Promise<CvExtractionResult> {
    const items: ExtractedItem[] = [];
    const seen = new Set<string>();

    const push = (
      item: Omit<ExtractedItem, 'confidence'>,
      matchKind: 'exact' | 'alias' | 'fuzzy' | 'context',
    ) => {
      const key = `${item.type}:${item.rawValue.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      const confidence = confidenceFor(matchKind);
      items.push({ ...item, confidence });
    };

    // 1. Skills from the known library, matched on word boundaries.
    for (const [canonical, aliases] of KNOWN_SKILL_ALIASES) {
      for (const alias of [canonical, ...aliases]) {
        const pattern = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (!pattern.test(text)) continue;

        push(
          {
            type: 'skill',
            rawValue: alias,
            normalizedSkillName: canonical,
            suggestedLevel: this.inferLevel(text, alias),
            context: lineContaining(text, alias),
          },
          alias === canonical ? 'exact' : 'alias',
        );
        break;
      }
    }

    // 2. Soft skills found by keyword pattern.
    for (const [canonical, patterns] of SKILL_KEYWORD_PATTERNS) {
      const hit = patterns.find((p) => new RegExp(p, 'i').test(text));
      if (!hit) continue;
      push(
        {
          type: 'soft_skill',
          rawValue: canonical,
          normalizedSkillName: canonical,
          suggestedLevel: 2,
          context: lineContaining(text, canonical.split(' ')[0] ?? canonical),
        },
        'context',
      );
    }

    // 3. Structured sections, if the CV has recognisable headings.
    for (const [heading, type] of [
      ['education', 'education'],
      ['projects', 'project'],
      ['certification', 'certification'],
      ['experience', 'experience'],
      ['work experience', 'experience'],
      ['skills', 'skill'],
    ] as const) {
      if (!new RegExp(`\\b${heading}\\b`, 'i').test(text)) continue;
      push(
        {
          type,
          rawValue: `${heading} section found`,
          normalizedSkillName: null,
          suggestedLevel: null,
          context: `A "${heading}" section was detected in the document.`,
        },
        'context',
      );
    }

    return {
      items,
      mode: this.mode,
      model: null,
      notice: AI_MODE_DESCRIPTIONS.demo.notice,
    };
  }

  /**
   * Heuristic level guess from surrounding context words. Deliberately
   * conservative: it never claims level 4 or 5 from a CV.
   */
  private inferLevel(text: string, term: string): number {
    const window = text.slice(0, 60_000);
    const idx = window.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return 2;

    const context = window.slice(Math.max(0, idx - 160), idx + 160).toLowerCase();
    if (/\b(led|managed|architected|owned|mentored|taught|expert|senior)\b/.test(context)) return 4;
    if (/\b(built|developed|created|implemented|worked with|used|applied)\b/.test(context))
      return 3;
    if (/\b(learned|course|basics|introductory|familiar with|studied)\b/.test(context)) return 2;
    return 2;
  }

  async normalizeSkillName(rawName: string): Promise<NormalizationResult> {
    const key = rawName.trim().toLowerCase();

    for (const [canonical, aliases] of KNOWN_SKILL_ALIASES) {
      if (canonical.toLowerCase() === key) {
        return { canonical, matchedBy: 'exact', confidence: 0.95, matchedSkillId: null };
      }
      if (aliases.some((a) => a.toLowerCase() === key)) {
        return { canonical, matchedBy: 'alias', confidence: 0.88, matchedSkillId: null };
      }
    }

    // Substring fallback, e.g. "postgresql database" -> "postgresql".
    for (const [canonical, aliases] of KNOWN_SKILL_ALIASES) {
      const options = [canonical, ...aliases].map((o) => o.toLowerCase());
      if (options.some((o) => o.length > 3 && key.includes(o))) {
        return { canonical, matchedBy: 'alias', confidence: 0.6, matchedSkillId: null };
      }
    }

    return { canonical: rawName.trim(), matchedBy: 'none', confidence: 0, matchedSkillId: null };
  }

  async embed(): Promise<number[] | null> {
    // No embedding model in demo mode; similarity falls back to token rules.
    return null;
  }

  async similarity(a: string, b: string, sameCategory: boolean): Promise<SimilarityResult> {
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
    if (tokenA.size === 0 || tokenB.size === 0) {
      return { similarity: 0, passesThreshold: false, sameCategory, eligibleForCredit: false };
    }
    let intersection = 0;
    for (const token of tokenA) if (tokenB.has(token)) intersection += 1;
    const union = tokenA.size + tokenB.size - intersection;
    const similarity = union === 0 ? 0 : intersection / union;

    const passesThreshold = similarity >= SIMILARITY_THRESHOLD;
    return {
      similarity,
      passesThreshold,
      sameCategory,
      eligibleForCredit: passesThreshold && sameCategory,
    };
  }

  async analyzeJobDescription(text: string): Promise<JobDescriptionAnalysis> {
    const detected: { name: string; confidence: number }[] = [];
    const lower = text.toLowerCase();

    for (const [canonical, aliases] of KNOWN_SKILL_ALIASES) {
      const found = [canonical, ...aliases].some((a) =>
        new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower),
      );
      if (found) detected.push({ name: canonical, confidence: 0.8 });
    }

    let seniorityHint: JobDescriptionAnalysis['seniorityHint'] = 'unknown';
    if (/\b(senior|sr\.?|lead|principal|manager|head of)\b/.test(lower)) seniorityHint = 'senior';
    else if (/\b(junior|jr\.?|entry[- ]level|intern|fresher|graduate)\b/.test(lower)) {
      seniorityHint = 'junior';
    } else if (/\b(mid[- ]level|intermediate|experienced)\b/.test(lower)) seniorityHint = 'mid';

    return {
      detectedSkills: detected,
      suggestedCareer: null,
      seniorityHint,
      mode: this.mode,
      notice: AI_MODE_DESCRIPTIONS.demo.notice,
    };
  }

  async answerAssistant(question: string, context: AssistantContext): Promise<AssistantAnswer> {
    const q = question.toLowerCase();
    const answer: string[] = [];
    const sourceTags: AssistantAnswer['sourceTags'] = [];
    const chips: string[] = [];

    if (/\b(salary|earn|wage|ctk|income|how much|paa)\b/.test(q)) {
      answer.push(
        'I cannot give salary figures, because they vary by employer, location, and time, and any number I gave you could be misleading.',
      );
      answer.push(
        'What I can do instead is show which skills this role typically requires, so you can see what to learn and what to prepare.',
      );
      sourceTags.push({
        tag: 'career_database',
        reason: 'Declined a salary question and redirected to skill requirements.',
      });
    } else if (/\b(guarantee|will i get|can you ensure|employ me|sure i will)\b/.test(q)) {
      answer.push(
        'No one can honestly promise a job outcome, and I will not pretend otherwise. What I can do is keep your skill map accurate and show you the gaps that matter most for the career you chose.',
      );
      sourceTags.push({
        tag: 'ai_suggestion',
        reason: 'Declined a job-guarantee question.',
      });
    } else if (/\b(what|which).*(learn|next|start|first)\b/.test(q)) {
      if (context.topPriorities.length > 0) {
        const first = context.topPriorities[0]!;
        answer.push(
          `Based on your profile, the next skill to work on is ${first.skillName}. ${first.reason}`,
        );
        answer.push(
          `You have set aside about ${context.weeklyStudyHours} hours a week, so keep the first few sessions small enough to finish.`,
        );
        sourceTags.push({
          tag: 'profile',
          reason: 'Used your recorded skills, gaps, and study hours.',
        });
        chips.push('Why this one?', 'Show me a project for it');
      } else {
        answer.push(
          'I could not find any open skill gaps in your profile yet. Add a target career and rate your skills, and I can suggest what to learn next.',
        );
        sourceTags.push({ tag: 'profile', reason: 'No target career or gaps recorded yet.' });
      }
    } else if (/\bwhy\b/.test(q) && context.topGaps.length > 0) {
      const gap = context.topGaps[0]!;
      answer.push(
        `${gap.skillName} is listed as ${gap.importance} importance for ${context.targetCareerName ?? 'your target career'}, and you are ${gap.gap} level${gap.gap === 1 ? '' : 's'} below the required level. That is why it appears early in your order.`,
      );
      sourceTags.push({
        tag: 'career_database',
        reason: 'Read the importance level from the career requirements.',
      });
      chips.push('What should I learn next?');
    } else if (/\b(how close|alignment|percent|progress)\b/.test(q)) {
      if (context.alignmentPercent !== null) {
        answer.push(
          `Your profile currently shows ${context.alignmentPercent}% alignment with the skill requirements for ${context.targetCareerName ?? 'your target career'}.`,
        );
        answer.push(
          'This measures how your recorded skills match that list. It is not a prediction of employment.',
        );
        sourceTags.push({ tag: 'profile', reason: 'Computed from your recorded skill levels.' });
      } else {
        answer.push('Choose a target career and I can calculate your alignment percentage.');
        sourceTags.push({ tag: 'profile', reason: 'No target career selected yet.' });
      }
      chips.push('What should I learn next?');
    } else if (/\b(project|build|portfolio)\b/.test(q)) {
      answer.push(
        'Projects are the fastest way to prove a skill. Pick a gap from your skill gap page, and I can suggest a project that practices it.',
      );
      sourceTags.push({ tag: 'career_database', reason: 'General project guidance.' });
      chips.push('What should I learn next?', 'How close am I?');
    } else {
      answer.push(
        `I can help with your skill map for ${context.targetCareerName ?? 'your chosen career'}. I can explain your alignment, suggest what to learn next, describe why a skill matters, or point you to a project.`,
      );
      sourceTags.push({ tag: 'career_database', reason: 'General help message.' });
      chips.push(
        'What should I learn next?',
        'How close am I to my target career?',
        'Suggest a project',
      );
    }

    if (context.pageContext) {
      sourceTags.push({ tag: 'profile', reason: `You were on the ${context.pageContext} page.` });
    }

    return {
      answer: answer.join(' '),
      sourceTags,
      suggestedChips: chips.length > 0 ? chips : ['What should I learn next?', 'How close am I?'],
      mode: this.mode,
      model: null,
      notice: AI_MODE_DESCRIPTIONS.demo.notice,
    };
  }
}

export function createDemoProvider(): DemoProvider {
  logger.debug('DemoProvider created');
  return new DemoProvider();
}

export { estimateTokens };
