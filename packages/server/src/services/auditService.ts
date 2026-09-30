/**
 * Audit logging.
 *
 * Records security-relevant actions. Never stores passwords, tokens, CV text,
 * or any other user content — only identifiers, actions, and outcomes.
 *
 * Audit writes must never break the request they are recording, so every
 * failure here is swallowed after logging.
 */

import type { Types } from 'mongoose';
import { models } from '../models/index.js';
import { logger } from '../utils/logger.js';

export interface AuditInput {
  actorUserId: Types.ObjectId | string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  outcome?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await models.AuditLog.create({
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      outcome: input.outcome ?? 'success',
      metadata: sanitizeMetadata(input.metadata ?? {}),
      ip: input.ip ?? null,
    });
  } catch (error) {
    logger.warn('Audit log write failed', {
      action: input.action,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'apikey',
  'cvtext',
  'text',
  'body',
]);

function sanitizeMetadata(metadata: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 4) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === 'string' && value.length > 200) {
      out[key] = `${value.slice(0, 200)}…`;
    } else if (value && typeof value === 'object') {
      out[key] = sanitizeMetadata(value as Record<string, unknown>, depth + 1);
    } else {
      out[key] = value;
    }
  }
  return out;
}
