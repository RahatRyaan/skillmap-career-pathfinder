/**
 * Database connection.
 *
 * Local dev and CI use a plain mongodb:// URL. Production uses Atlas SRV.
 * The Atlas free tier allows only 5 concurrent IP connections per cluster, so
 * the pool is capped deliberately and the server retries with backoff rather
 * than hammering a cluster that is waking up.
 */

import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let connecting: Promise<typeof mongoose> | null = null;

const POOL_MAX = config.db.isAtlas ? 5 : 20;

export async function connectDatabase(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  mongoose.set('strictQuery', true);

  connecting = mongoose
    .connect(config.db.uri, {
      maxPoolSize: POOL_MAX,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10_000,
      socketTimeoutMS: 45_000,
      maxIdleTimeMS: 60_000,
      retryWrites: true,
      autoIndex: !config.isProduction,
    })
    .then((m) => {
      logger.info('Database connected', {
        mode: config.db.mode,
        isAtlas: config.db.isAtlas,
        maxPoolSize: POOL_MAX,
      });
      return m;
    })
    .catch((error: unknown) => {
      connecting = null;
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Database connection failed', { message });
      throw new Error(
        `Could not connect to MongoDB. Check MONGODB_URI, that the cluster is resumed, and that this machine's IP (${config.db.isAtlas ? 'required for Atlas' : 'n/a for local'}) is in the Atlas IP access list. Underlying error: ${message}`,
        { cause: error },
      );
    });

  return connecting;
}

export async function disconnectDatabase(): Promise<void> {
  connecting = null;
  await mongoose.disconnect();
  logger.info('Database disconnected');
}

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Atlas free-tier clusters sleep when idle and can take ~30s to wake.
 * Retries the given operation so a cold start does not fail the first request.
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 2000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isConnectionIssue =
        error instanceof Error &&
        /buffering timed out|server selection|ECONNREFUSED|not connected|topology/i.test(
          error.message,
        );
      if (!isConnectionIssue || attempt === attempts) break;
      logger.warn('Database operation retrying', { attempt, delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw lastError;
}
