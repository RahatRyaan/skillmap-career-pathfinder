/**
 * Structured logger.
 *
 * The only sanctioned way to write output. JSON in production so a log
 * aggregator can parse it, human-readable in development.
 *
 * Note: no secrets, tokens, emails, CV text, or user-submitted content may be
 * logged. Log identifiers and counts only.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'cookie',
  'secret',
  'apiKey',
  'api_key',
  'mongodbUri',
  'connectionString',
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_KEYS.has(key) ? '[redacted]' : redact(val, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) {
    return `${value.slice(0, 500)}…[truncated]`;
  }
  return value;
}

class Logger {
  private readonly minLevel: number;

  constructor(env: string) {
    this.minLevel = env === 'test' ? LEVEL_ORDER.error : LEVEL_ORDER.debug;
  }

  private emit(level: Level, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < this.minLevel) return;

    const safeContext = context ? (redact(context) as Record<string, unknown>) : undefined;

    if (process.env['NODE_ENV'] === 'production') {
      process.stdout.write(
        `${JSON.stringify({
          level,
          message,
          time: new Date().toISOString(),
          ...(safeContext ?? {}),
        })}\n`,
      );
      return;
    }

    const time = new Date().toISOString().slice(11, 23);
    const label = level.toUpperCase().padEnd(5);
    const suffix =
      safeContext && Object.keys(safeContext).length > 0 ? ` ${JSON.stringify(safeContext)}` : '';
    process.stdout.write(`${time} ${label} ${message}${suffix}\n`);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.emit('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.emit('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.emit('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.emit('error', message, context);
  }
}

import { config } from '../config/env.js';

export const logger = new Logger(config.env);
