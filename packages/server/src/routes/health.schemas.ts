/** Schemas for system endpoints. */

import { z } from 'zod';
import { AI_MODES } from '@skillmap/shared';

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number(),
  database: z.enum(['connected', 'disconnected']),
  aiMode: z.enum(AI_MODES),
  timestamp: z.string(),
});

export const aiModeSchema = z.object({
  mode: z.enum(AI_MODES),
  available: z.boolean(),
  description: z.string(),
  usesRealLlm: z.boolean(),
  usesLocalEmbeddings: z.boolean(),
  deterministic: z.boolean(),
  notice: z.string().nullable(),
});

export type AiModeInfo = z.infer<typeof aiModeSchema>;
