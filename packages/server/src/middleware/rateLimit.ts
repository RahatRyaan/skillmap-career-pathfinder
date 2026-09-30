/**
 * Rate limiters.
 *
 * Strict limits on credential endpoints, upload, and the AI assistant, because
 * those are the paths an attacker would automate. A looser global limit sits in
 * front of everything else.
 *
 * In test the limits are effectively disabled so a suite of 40 API tests does
 * not trip a 5-request login limit.
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';

/**
 * In test the limit is effectively disabled, so a suite of 40 API tests does
 * not trip a 5-request login limit.
 */
function build(windowMs: number, max: number, message: string) {
  return rateLimit({
    windowMs,
    limit: config.isTest ? 10_000 : max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.isTest,
    handler: (_req, _res, next) => next(new AppError('RATE_LIMITED', message)),
  });
}

export const globalLimiter = build(
  60_000,
  config.rateLimit.global,
  'Too many requests. Please wait a moment and try again.',
);

export const loginLimiter = build(
  15 * 60_000,
  config.rateLimit.login,
  'Too many sign-in attempts. Please wait 15 minutes before trying again.',
);

export const uploadLimiter = build(
  60 * 60_000,
  config.rateLimit.upload,
  'You have reached the CV upload limit for this hour.',
);

export const assistantLimiter = build(
  60_000,
  config.rateLimit.assistant,
  'You are sending messages too quickly. Please slow down.',
);

export const writeLimiter = build(60_000, 60, 'Too many changes at once. Please wait a moment.');
