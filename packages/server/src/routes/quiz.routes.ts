/**
 * Career Discovery Quiz.
 *
 * Deterministic by design: each option carries a career slug, and scores are
 * counted per slug. No model is involved, so the same answers always produce
 * the same three suggestions and the result is reproducible and explainable.
 */

import { Router } from 'express';
import type { Express, Response } from 'express';
import type { Types } from 'mongoose';
import { quizSubmitSchema, type QuizSuggestion, type QuizSubmitRequest } from '@skillmap/shared';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { notFound } from '../utils/errors.js';
import { models } from '../models/index.js';

export function registerQuizRoutes(app: Express): void {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/quiz/questions',
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
      const questions = (await models.QuizQuestion.find({ isPublished: true })
        .sort({ order: 1 })
        .lean()) as {
        _id: Types.ObjectId;
        order: number;
        prompt: string;
        options: { text: string; careerSlug: string | null }[];
      }[];

      res.json(
        questions.map((q) => ({
          id: q._id.toString(),
          order: q.order,
          prompt: q.prompt,
          // The careerSlug is deliberately withheld: revealing it would let a
          // student reverse the scoring instead of answering honestly.
          options: q.options.map((o) => ({ text: o.text })),
        })),
      );
    }),
  );

  router.post(
    '/quiz/submit',
    validate({ body: quizSubmitSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = (req as ValidatedRequest<QuizSubmitRequest>).validated.body!;

      const questions = (await models.QuizQuestion.find({ isPublished: true })
        .sort({ order: 1 })
        .lean()) as {
        _id: Types.ObjectId;
        options: { text: string; careerSlug: string | null }[];
      }[];

      const byId = new Map(questions.map((q) => [q._id.toString(), q]));

      const scores = new Map<string, number>();
      let answered = 0;

      for (const answer of body.answers) {
        const question = byId.get(answer.questionId);
        if (!question) continue;
        const option = question.options[answer.optionIndex];
        if (!option?.careerSlug) continue;
        scores.set(option.careerSlug, (scores.get(option.careerSlug) ?? 0) + 1);
        answered += 1;
      }

      if (answered === 0) {
        res.json({ suggestions: [], message: 'No answers could be scored. Please try again.' });
        return;
      }

      const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);

      const careers = (await models.Career.find({
        slug: { $in: ranked.map(([slug]) => slug) },
        isPublished: true,
      })
        .select('name slug summary')
        .lean()) as { _id: Types.ObjectId; name: string; slug: string; summary: string }[];

      const bySlug = new Map(careers.map((c) => [c.slug, c]));

      const suggestions: QuizSuggestion[] = ranked.flatMap(([slug, score]) => {
        const career = bySlug.get(slug);
        if (!career) return [];
        return [
          {
            careerId: career._id.toString(),
            careerName: career.name,
            // A share of the answers that pointed here, not a probability.
            matchPercent: Math.round((score / answered) * 100),
            explanation: buildExplanation(career.summary, score, answered),
          },
        ];
      });

      await models.QuizResponse.create({
        userId: (req as AuthenticatedRequest & { userId?: string }).userId,
        answers: body.answers,
        suggestedCareerIds: suggestions.map((s) => s.careerId),
      });

      res.json({
        suggestions,
        answeredQuestions: answered,
        note: 'These are suggestions based on your answers, not a prediction. Look at the skill requirements before deciding.',
      });
    }),
  );

  app.use('/api', router);
}

function buildExplanation(summary: string, score: number, answered: number): string {
  const share = Math.round((score / answered) * 100);
  const strength =
    share >= 70
      ? 'Most of your answers pointed here'
      : share >= 40
        ? 'Several of your answers pointed here'
        : 'A few of your answers pointed here';

  return `${strength}. ${summary} Look at the required skills and compare them with your own before you commit — the quiz only points at a starting point, it does not decide for you.`;
}

export { notFound };
