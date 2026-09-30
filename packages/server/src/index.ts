/**
 * Process entry point.
 *
 * Order matters: validate config, connect to the database, then listen. A
 * process that cannot reach the database must not accept traffic, because every
 * request would fail anyway and the failure would be harder to diagnose.
 */

import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/connect.js';
import { checkAiHealth, getModeInfo } from './ai/aiService.js';
import { ensureUploadDir } from './services/uploadService.js';
import { ensureAdminUser } from './services/adminSeed.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting SkillMap API', {
    env: config.env,
    port: config.port,
    dbMode: config.db.mode,
    aiMode: getModeInfo().mode,
  });

  await connectDatabase();
  await ensureUploadDir();

  if (config.env !== 'test') {
    await ensureAdminUser();
  }

  const aiHealth = await checkAiHealth();
  if (aiHealth.notice) logger.warn(aiHealth.notice);

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('API listening', { port: config.port, aiMode: aiHealth.mode });
  });

  const shutdown = (signal: string) => {
    logger.info('Shutting down', { signal });
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception, shutting down', { message: error.message });
    shutdown('uncaughtException');
  });
}

main().catch((error: unknown) => {
  logger.error('Fatal startup error', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
