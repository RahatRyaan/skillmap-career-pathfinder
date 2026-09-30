/**
 * Environment configuration.
 *
 * Parsed and validated ONCE at boot. A misconfigured deployment must fail
 * immediately with a clear message, never at the first request. Secrets are
 * read here and nowhere else; nothing else may call process.env directly.
 */

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { AI_MODES } from '@skillmap/shared';

/**
 * The .env file lives at the repository root, but an npm workspace script runs
 * with the cwd set to the package directory. Without walking up, a workspace
 * script silently sees no configuration and reports every required value as
 * missing, which is misleading. The first .env found walking upward wins;
 * a real environment variable always takes precedence over the file.
 */
function loadRootEnv(): void {
  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate });
      return;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  loadDotenv();
}

loadRootEnv();

const csv = (value: string): string[] =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  DB_MODE: z.enum(['local', 'atlas']).default('local'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  ADMIN_EMAIL: z.string().email().default('admin@skillmap.ai'),
  ADMIN_PASSWORD: z.string().min(8).default('ChangeMe_Admin_2026'),

  AI_MODE: z.enum(AI_MODES).default('demo'),
  OPENAI_BASE_URL: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL_EXTRACTION: z.string().default(''),
  OPENAI_MODEL_CHAT: z.string().default(''),
  AI_BUDGET_USD: z.coerce.number().min(0).default(0),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),
  ALLOWED_UPLOAD_TYPES: z.string().default('application/pdf'),

  RATE_LIMIT_LOGIN: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_UPLOAD: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_ASSISTANT: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_GLOBAL: z.coerce.number().int().positive().default(300),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const raw = parsed.data;

if (raw.JWT_ACCESS_SECRET === raw.JWT_REFRESH_SECRET) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values');
}

if (raw.AI_MODE === 'openai' && raw.OPENAI_API_KEY.length === 0) {
  throw new Error(
    'AI_MODE=openai requires OPENAI_API_KEY. Set AI_MODE=demo or AI_MODE=local instead.',
  );
}

if (raw.NODE_ENV === 'production') {
  const weak = ['replace_me', 'changeme', 'ChangeMe', 'secret', 'password'];
  for (const value of [raw.JWT_ACCESS_SECRET, raw.JWT_REFRESH_SECRET, raw.ADMIN_PASSWORD]) {
    if (weak.some((w) => value.toLowerCase().includes(w.toLowerCase()))) {
      throw new Error('Refusing to start in production with a placeholder secret');
    }
  }
  if (raw.ADMIN_PASSWORD === 'ChangeMe_Admin_2026') {
    throw new Error('ADMIN_PASSWORD must be changed before deploying to production');
  }
}

export const config = {
  env: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  clientOrigin: raw.CLIENT_ORIGIN,

  db: {
    uri: raw.MONGODB_URI,
    mode: raw.DB_MODE,
    isAtlas: raw.MONGODB_URI.startsWith('mongodb+srv://'),
  },

  auth: {
    accessSecret: raw.JWT_ACCESS_SECRET,
    refreshSecret: raw.JWT_REFRESH_SECRET,
    accessTtl: raw.JWT_ACCESS_TTL,
    refreshTtl: raw.JWT_REFRESH_TTL,
    bcryptRounds: raw.BCRYPT_ROUNDS,
  },

  admin: {
    email: raw.ADMIN_EMAIL,
    password: raw.ADMIN_PASSWORD,
  },

  ai: {
    mode: raw.AI_MODE,
    baseUrl: raw.OPENAI_BASE_URL,
    apiKey: raw.OPENAI_API_KEY,
    extractionModel: raw.OPENAI_MODEL_EXTRACTION,
    chatModel: raw.OPENAI_MODEL_CHAT,
    budgetUsd: raw.AI_BUDGET_USD,
  },

  uploads: {
    dir: raw.UPLOAD_DIR,
    maxBytes: raw.MAX_UPLOAD_BYTES,
    allowedTypes: csv(raw.ALLOWED_UPLOAD_TYPES),
  },

  rateLimit: {
    login: raw.RATE_LIMIT_LOGIN,
    upload: raw.RATE_LIMIT_UPLOAD,
    assistant: raw.RATE_LIMIT_ASSISTANT,
    global: raw.RATE_LIMIT_GLOBAL,
  },

  cors: {
    origins: csv(raw.CORS_ORIGINS),
  },
} as const;

export type AppConfig = typeof config;
