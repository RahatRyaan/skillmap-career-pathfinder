/**
 * Route registration.
 *
 * Every feature module registers under /api. Nothing else mounts a router, so
 * the full API surface is readable in one file.
 */

import type { Express } from 'express';
import { asyncHandler } from '../middleware/validate.js';
import { config } from '../config/env.js';
import { isDatabaseConnected } from '../db/connect.js';
import { getModeInfo, checkAiHealth } from '../ai/aiService.js';
import { healthSchema, aiModeSchema } from './health.schemas.js';
import { registerAuthRoutes } from './auth.routes.js';
import { registerProfileRoutes } from './profile.routes.js';
import { registerCatalogRoutes } from './catalog.routes.js';

export function registerRoutes(app: Express): void {
  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      const dbConnected = isDatabaseConnected();
      res.status(dbConnected ? 200 : 503).json({
        status: dbConnected ? 'ok' : 'degraded',
        version: process.env['npm_package_version'] ?? '1.0.0',
        uptimeSeconds: Math.floor(process.uptime()),
        database: dbConnected ? 'connected' : 'disconnected',
        aiMode: getModeInfo().mode,
        timestamp: new Date().toISOString(),
      });
    }),
  );

  app.get(
    '/api/system/ai-mode',
    asyncHandler(async (_req, res) => {
      const health = await checkAiHealth();
      const info = getModeInfo();
      const parsed = aiModeSchema.parse({
        mode: info.mode,
        available: health.available,
        description: info.description,
        usesRealLlm: info.usesRealLlm,
        usesLocalEmbeddings: info.usesLocalEmbeddings,
        deterministic: info.deterministic,
        notice: health.notice ?? info.notice,
      });
      res.json(parsed);
    }),
  );

  app.get('/api/config/public', (_req, res) => {
    // Non-secret settings the client needs before it can render anything.
    res.json({
      aiMode: getModeInfo().mode,
      maxUploadBytes: config.uploads.maxBytes,
      allowedUploadTypes: config.uploads.allowedTypes,
      registrationOpen: true,
    });
  });

  registerAuthRoutes(app);
  registerProfileRoutes(app);
  registerCatalogRoutes(app);
}

export { healthSchema };
