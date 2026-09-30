/**
 * Ensures exactly one admin account exists.
 *
 * Idempotent: safe to run on every boot. The password comes from the
 * environment and is hashed before storage.
 */

import type { Types } from 'mongoose';
import { config } from '../config/env.js';
import { models } from '../models/index.js';
import { hashPassword } from '../utils/tokens.js';
import { logger } from '../utils/logger.js';

export async function ensureAdminUser(): Promise<Types.ObjectId | null> {
  const email = config.admin.email.toLowerCase();

  const existing = (await models.User.findOne({ email, role: 'admin' }).select('_id').lean()) as {
    _id: Types.ObjectId;
  } | null;

  if (existing) return existing._id;

  const passwordHash = await hashPassword(config.admin.password);

  const admin = (await models.User.create({
    name: 'SkillMap Admin',
    email,
    passwordHash,
    role: 'admin',
    isActive: true,
  })) as unknown as { _id: Types.ObjectId };

  await models.UserPreferences.create({ userId: admin._id });
  await models.StudentProfile.create({ userId: admin._id });

  logger.info('Admin account created', { email });
  return admin._id;
}
