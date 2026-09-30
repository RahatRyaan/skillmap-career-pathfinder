/**
 * CV upload, extraction, and the review gate.
 *
 * The critical guarantee: NOTHING from an uploaded CV reaches the student's
 * profile until they explicitly accept it. Extraction writes rows with
 * decision = 'pending' and nothing else. Only the review endpoint promotes
 * accepted items into userSkills.
 *
 * A test asserts that uploading a CV does not change the student's skill count.
 */

import { Router } from 'express';
import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import multer from 'multer';
import { Types } from 'mongoose';
import {
  cvReviewSchema,
  type CvDocumentResponse,
  type CvReviewRequest,
  type ExtractedItem,
} from '@skillmap/shared';
import { config } from '../config/env.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { asyncHandler, validate, type ValidatedRequest } from '../middleware/validate.js';
import { getUserId, requireAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { AppError, notFound } from '../utils/errors.js';
import { models } from '../models/index.js';
import { extractCvSkills, normalizeSkill } from '../ai/aiService.js';
import { buildStoredName, ensureUploadDir, resolveUploadPath } from '../services/uploadService.js';
import { writeAuditLog } from '../services/auditService.js';
import { SAMPLE_CVS } from '../scripts/seedDemoStudent.js';
import { logger } from '../utils/logger.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxBytes, files: 1 },
  fileFilter: (_req: Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    if (!config.uploads.allowedTypes.includes(file.mimetype)) {
      callback(
        new AppError(
          'UNSUPPORTED_MEDIA_TYPE',
          `Only ${config.uploads.allowedTypes.join(' and ')} files are accepted.`,
        ),
      );
      return;
    }
    callback(null, true);
  },
});

const LOW_CONFIDENCE = 0.7;

export function registerCvRoutes(app: Express): void {
  const router = Router();
  router.use(requireAuth);

  // ─── Upload ───────────────────────────────────────────────────────────
  router.post(
    '/cv/upload',
    uploadLimiter,
    (req: Request, res: Response, next: (err?: unknown) => void) => {
      upload.single('file')(req, res, (error: unknown) => {
        if (!error) return next();
        if (error instanceof multer.MulterError) {
          if (error.code === 'LIMIT_FILE_SIZE') {
            return next(
              new AppError(
                'PAYLOAD_TOO_LARGE',
                `That file is larger than the ${Math.round(config.uploads.maxBytes / 1024 / 1024)}MB limit.`,
              ),
            );
          }
          return next(new AppError('BAD_REQUEST', 'The upload could not be processed.'));
        }
        return next(error);
      });
    },
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const file = (req as Request & { file?: Express.Multer.File }).file;

      if (!file) {
        throw new AppError('BAD_REQUEST', 'No file was uploaded. Attach a PDF or DOCX as "file".');
      }

      await ensureUploadDir();

      const storedFileName = buildStoredName(userId.toString(), file.mimetype);
      const diskPath = resolveUploadPath(storedFileName);

      // The extension comes from the MIME allow-list, never from the client's
      // filename, so a crafted name cannot introduce a new extension.
      const { writeFile } = await import('node:fs/promises');
      await writeFile(diskPath, file.buffer, { mode: 0o600 });

      let text = '';
      try {
        text = await extractText(file.buffer, file.mimetype);
      } catch (error) {
        await unlink(diskPath).catch(() => undefined);
        logger.warn('CV text extraction failed', {
          message: error instanceof Error ? error.message : 'unknown',
        });
        throw new AppError(
          'BAD_REQUEST',
          'We could not read text from that file. If it is a scanned image, try a text-based PDF or a DOCX.',
        );
      }

      if (text.trim().length < 40) {
        await unlink(diskPath).catch(() => undefined);
        throw new AppError(
          'BAD_REQUEST',
          'Very little readable text was found. If this is a scanned document, we cannot read it yet.',
        );
      }

      const doc = await models.CvDocument.create({
        userId,
        storedFileName,
        originalFileName: file.originalname.slice(0, 260),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        status: 'extracted',
        textLength: text.length,
        extractionMode: config.ai.mode,
        extractedText: text,
      });

      const items = await runExtraction(doc._id, userId, text);

      await writeAuditLog({
        actorUserId: userId,
        action: 'cv.upload',
        entity: 'cvDocument',
        entityId: doc._id.toString(),
        metadata: { sizeBytes: file.size, items: items.length, mode: config.ai.mode },
      });

      res.status(201).json(await toResponse(doc._id, userId));
    }),
  );

  // ─── Read one ─────────────────────────────────────────────────────────
  router.get(
    '/cv/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const id = parseId((req.params as { id: string }).id);
      res.json(await toResponse(id, userId));
    }),
  );

  // ─── List the student's CVs ───────────────────────────────────────────
  router.get(
    '/cv',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const docs = await models.CvDocument.find({ userId })
        .sort({ createdAt: -1 })
        .select('_id')
        .lean();

      const items = await Promise.all(docs.map((d) => toResponse(d._id as Types.ObjectId, userId)));
      res.json({ items });
    }),
  );

  // ─── Review gate ──────────────────────────────────────────────────────
  /**
   * The only path from a CV to a student's profile. Each item is accepted,
   * rejected, or edited; accepted skills become userSkills.
   */
  router.put(
    '/cv/:id/review',
    validate({ body: cvReviewSchema }),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const id = parseId((req.params as { id: string }).id);
      const body = (req as ValidatedRequest<CvReviewRequest>).validated.body!;

      const doc = await models.CvDocument.findOne({ _id: id, userId });
      if (!doc) throw notFound('CV');

      const rows = (await models.ExtractedSkill.find({ cvDocumentId: id, userId }).lean()) as {
        _id: Types.ObjectId;
        extractionId: string;
        decision: string;
      }[];

      const byExtractionId = new Map(rows.map((r) => [r.extractionId, r]));
      let accepted = 0;
      let rejected = 0;
      let edited = 0;

      for (const decision of body.items) {
        const existing = byExtractionId.get(decision.extractionId);
        if (!existing) continue;

        const nextDecision =
          decision.decision === 'accept'
            ? 'accepted'
            : decision.decision === 'reject'
              ? 'rejected'
              : 'edited';

        await models.ExtractedSkill.updateOne(
          { _id: existing._id },
          {
            $set: {
              decision: nextDecision,
              ...(decision.level !== undefined ? { suggestedLevel: decision.level } : {}),
              ...(decision.value !== undefined ? { rawValue: decision.value } : {}),
              ...(decision.skillId !== undefined ? { normalizedSkillId: decision.skillId } : {}),
            },
          },
        );

        if (nextDecision === 'rejected') {
          rejected += 1;
          continue;
        }

        if (nextDecision === 'edited') edited += 1;
        else accepted += 1;

        // Only skill-type items with a resolved catalogue id touch the profile.
        const item = await models.ExtractedSkill.findById(existing._id).lean();
        if (!item || item.type !== 'skill' || !item.normalizedSkillId) continue;

        const level = (decision.level ?? item.suggestedLevel ?? 2) as 0 | 1 | 2 | 3 | 4 | 5;

        await models.UserSkill.updateOne(
          { userId, skillId: item.normalizedSkillId },
          {
            $set: {
              // AI-extracted skills always keep their source badge so the
              // student can see they were suggested, not asserted.
              source: nextDecision === 'edited' ? 'self_reported' : 'ai_extracted',
            },
            $max: { level },
          },
          { upsert: true },
        );
      }

      doc.status = 'reviewed';
      await doc.save();

      await writeAuditLog({
        actorUserId: userId,
        action: 'cv.review',
        entity: 'cvDocument',
        entityId: id.toString(),
        metadata: { accepted, rejected, edited },
      });

      res.json({
        ...(await toResponse(id, userId)),
        summary: {
          accepted,
          rejected,
          edited,
          message:
            accepted + edited > 0
              ? `${accepted + edited} item${accepted + edited === 1 ? '' : 's'} added to your profile. Anything the AI extracted is marked so you can see where it came from.`
              : 'Nothing was added to your profile. You can come back and review this CV later.',
        },
      });
    }),
  );

  // ─── Delete ───────────────────────────────────────────────────────────
  router.delete(
    '/cv/:id',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const id = parseId((req.params as { id: string }).id);

      const doc = await models.CvDocument.findOne({ _id: id, userId }).select('+storedFileName');
      if (!doc) throw notFound('CV');

      const { deleteStoredFile } = await import('../services/uploadService.js');
      await deleteStoredFile(doc.storedFileName);

      await models.ExtractedSkill.deleteMany({ cvDocumentId: id });
      await models.CvDocument.deleteOne({ _id: id });

      await writeAuditLog({
        actorUserId: userId,
        action: 'cv.delete',
        entity: 'cvDocument',
        entityId: id.toString(),
      });

      res.status(204).send();
    }),
  );

  // ─── Demo mode: fictional sample CVs ──────────────────────────────────
  router.get(
    '/cv/samples',
    asyncHandler(async (_req: Request, res: Response) => {
      res.json({
        notice:
          "These are fictional sample CVs written for demonstration. They contain no real person's data.",
        samples: SAMPLE_CVS.map((c) => ({
          slug: c.slug,
          title: c.title,
          textLength: c.text.length,
        })),
      });
    }),
  );

  /** Loads a fictional sample so the review flow can be demonstrated offline. */
  router.post(
    '/cv/samples/:slug',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const userId = getUserId(req);
      const slug = (req.params as { slug: string }).slug;
      const sample = SAMPLE_CVS.find((c) => c.slug === slug);
      if (!sample) throw notFound('Sample CV');

      const doc = await models.CvDocument.create({
        userId,
        storedFileName: `sample-${randomUUID()}.txt`,
        originalFileName: `${sample.slug}.txt`,
        mimeType: 'text/plain',
        sizeBytes: sample.text.length,
        status: 'extracted',
        textLength: sample.text.length,
        extractionMode: 'demo',
        extractedText: sample.text,
      });

      await runExtraction(doc._id, userId, sample.text);
      res.status(201).json({
        ...(await toResponse(doc._id, userId)),
        notice: 'This is a fictional sample CV. Nothing in it refers to a real person.',
      });
    }),
  );

  app.use('/api', router);
}

async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    const pdfParse = (await import('pdf-parse')).default as unknown as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    return parsed.text ?? '';
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = (await import('mammoth')).default as unknown as {
      extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const parsed = await mammoth.extractRawText({ buffer });
    return parsed.value ?? '';
  }

  return buffer.toString('utf8');
}

async function runExtraction(
  docId: Types.ObjectId,
  userId: Types.ObjectId,
  text: string,
): Promise<ExtractedItem[]> {
  const result = await extractCvSkills(text, userId.toString());

  // Resolve catalogue ids so the review screen can show real skill names and
  // the accept step can attach a foreign key.
  const catalog = (await models.Skill.find({ isPublished: true })
    .select('_id name aliases')
    .lean()) as { _id: Types.ObjectId; name: string; aliases: string[] }[];

  const byLowerName = new Map<string, Types.ObjectId>();
  for (const skill of catalog) {
    byLowerName.set(skill.name.toLowerCase(), skill._id);
    for (const alias of skill.aliases) byLowerName.set(alias.toLowerCase(), skill._id);
  }

  const withFallbacks: {
    item: (typeof result.items)[number];
    skillId: Types.ObjectId | null;
    canonicalName: string | null;
  }[] = [];

  for (const item of result.items) {
    const rawName = item.normalizedSkillName ?? item.rawValue;
    let skillId = byLowerName.get(String(rawName).toLowerCase()) ?? null;
    let canonicalName: string | null = item.normalizedSkillName;

    if (skillId !== null) {
      canonicalName =
        catalog.find((s) => s._id.toString() === skillId?.toString())?.name ?? canonicalName;
    } else if (item.type === 'skill') {
      // Fall back to the provider's own alias table.
      const normalized = await normalizeSkill(item.rawValue);
      if (normalized.matchedBy !== 'none') {
        skillId = byLowerName.get(normalized.canonical.toLowerCase()) ?? null;
        canonicalName = normalized.canonical;
      }
    }

    withFallbacks.push({ item, skillId, canonicalName });
  }

  const docs: Record<string, unknown>[] = withFallbacks.map(({ item, skillId, canonicalName }) => ({
    cvDocumentId: docId,
    userId,
    extractionId: `${docId}-${item.type}-${randomUUID().slice(0, 8)}`,
    type: item.type,
    rawValue: item.rawValue.slice(0, 300),
    normalizedSkillId: skillId,
    normalizedSkillName: canonicalName,
    confidence: item.confidence,
    lowConfidence: item.confidence < LOW_CONFIDENCE,
    suggestedLevel: item.suggestedLevel,
    context: item.context,
    decision: 'pending' as const,
  }));

  if (docs.length > 0) await models.ExtractedSkill.insertMany(docs);

  return withFallbacks.map(({ item, skillId, canonicalName }, index): ExtractedItem => ({
    extractionId: String(docs[index]?.['extractionId'] ?? ''),
    type: item.type,
    rawValue: item.rawValue,
    normalizedSkillId: skillId?.toString() ?? null,
    normalizedSkillName: canonicalName,
    suggestedLevel: item.suggestedLevel,
    confidence: item.confidence,
    lowConfidence: item.confidence < LOW_CONFIDENCE,
    context: item.context,
  }));
}

async function toResponse(
  docId: Types.ObjectId,
  userId: Types.ObjectId,
): Promise<CvDocumentResponse> {
  const doc = (await models.CvDocument.findOne({ _id: docId, userId }).lean()) as {
    _id: Types.ObjectId;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    status: 'uploaded' | 'extracted' | 'reviewed';
    textLength: number;
    extractionMode: string;
    createdAt: Date;
  } | null;

  if (!doc) throw notFound('CV');

  const items = (await models.ExtractedSkill.find({ cvDocumentId: docId, userId })
    .sort({ confidence: -1 })
    .lean()) as Record<string, any>[];

  return {
    id: doc._id.toString(),
    fileName: doc.originalFileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    status: doc.status,
    textLength: doc.textLength,
    extractionMode: doc.extractionMode,
    createdAt: new Date(doc.createdAt).toISOString(),
    items: items.map((i): ExtractedItem => ({
      extractionId: i.extractionId,
      type: i.type,
      rawValue: i.rawValue,
      normalizedSkillId: i.normalizedSkillId?.toString() ?? null,
      normalizedSkillName: i.normalizedSkillName,
      confidence: i.confidence,
      lowConfidence: i.lowConfidence,
      suggestedLevel: i.suggestedLevel,
      context: i.context,
    })),
  };
}

function parseId(value: string): Types.ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new AppError('VALIDATION_FAILED', 'Invalid CV id');
  }
  return new Types.ObjectId(value);
}
