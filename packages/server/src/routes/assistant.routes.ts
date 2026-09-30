/**
 * AI career assistant.
 *
 * The assistant is grounded in the student's own SkillMap data. The context
 * passed to the provider is built from real records, and the safety filter runs
 * on every outbound answer. Out-of-scope requests get a polite refusal rather
 * than a guess.
 */

import { Router } from 'express';
import type { Express, Response } from 'express';
import { Types } from 'mongoose';
import { assistantChatSchema, type AssistantResponse } from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { getUserId, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { assistantLimiter } from '../middleware/rateLimit.js';
import { models } from '../models/index.js';
import { analyzeCareer } from '../services/analysisService.js';
import { askAssistant } from '../ai/aiService.js';

export function registerAssistantRoutes(app: Express): void {
  const router = Router();
  router.use(requireAuth);

  router.post(
    '/assistant/chat',
    assistantLimiter,
    validate({ body: assistantChatSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const body = (req as ValidatedRequest<import('@skillmap/shared').AssistantChatRequest>)
        .validated.body!;

      const context = await buildContext(userId, body.pageContext);

      const answer = await askAssistant(body.message, context, userId.toString());

      const conversationId =
        body.conversationId ?? `${userId.toString()}-${Date.now().toString(36)}`;

      await models.AIInteraction.create({
        userId,
        kind: 'assistant_chat',
        mode: answer.mode,
        model: answer.model,
        inputHash: body.message.slice(0, 64),
        notice: answer.notice,
        success: true,
      });

      const response: AssistantResponse = {
        conversationId,
        answer: answer.answer,
        sourceTags: answer.sourceTags,
        mode: answer.mode,
        notice: answer.notice,
        suggestedChips: answer.suggestedChips,
      };

      res.json(response);
    }),
  );

  app.use('/api', router);
}

/**
 * Assembles the grounding context. Only real, recorded values go in, so the
 * assistant cannot invent a number the student does not actually have.
 */
async function buildContext(
  userId: Types.ObjectId,
  pageContext?: string,
): Promise<import('../ai/types.js').AssistantContext> {
  const [user, profile, prefs, owned] = await Promise.all([
    models.User.findById(userId).select('name').lean() as Promise<{ name: string } | null>,
    models.StudentProfile.findOne({ userId }).select('targetCareerId').lean() as Promise<{
      targetCareerId: Types.ObjectId | null;
    } | null>,
    models.UserPreferences.findOne({ userId }).lean() as Promise<{
      weeklyStudyHours: number;
    } | null>,
    models.UserSkill.find({ userId }).populate('skillId', 'name').lean() as unknown as Promise<
      { level: number; skillId: { name: string } | null }[]
    >,
  ]);

  const targetCareerId = profile?.targetCareerId ?? null;

  let careerName: string | null = null;
  let alignmentPercent: number | null = null;
  let topGaps: import('../ai/types.js').AssistantContext['topGaps'] = [];
  let topPriorities: import('../ai/types.js').AssistantContext['topPriorities'] = [];

  if (targetCareerId) {
    const [career, analysis] = await Promise.all([
      models.Career.findById(targetCareerId).select('name').lean() as Promise<{
        name: string;
      } | null>,
      analyzeCareer(userId, targetCareerId),
    ]);

    careerName = career?.name ?? null;
    alignmentPercent = analysis.alignment.percent;
    topGaps = analysis.gaps
      .filter((g) => g.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)
      .map((g) => ({ skillName: g.skillName, gap: g.gap, importance: g.importance }));
    topPriorities = analysis.priorities.slice(0, 3).map((p) => ({
      skillName: p.skillName,
      reason: `${p.skillName} is number ${p.rank} to learn because it is ${p.importance} importance with a gap of ${p.gap} and takes around ${p.estimatedEffortHours} hours.`,
    }));
  }

  return {
    studentName: user?.name ?? 'there',
    targetCareerName: careerName,
    alignmentPercent,
    topGaps,
    topPriorities,
    ownedSkills: owned.filter((s) => s.level > 0 && s.skillId?.name).map((s) => s.skillId!.name),
    weeklyStudyHours: prefs?.weeklyStudyHours ?? 5,
    ...(pageContext ? { pageContext } : {}),
  };
}
