/**
 * Express application assembly.
 *
 * Kept separate from index.ts so tests can mount the app without binding a port
 * or opening a database connection.
 */

import express, { type Express } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { registerRoutes } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  // Required for correct client IPs (rate limiting) and req.secure detection.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The API serves JSON only; a restrictive CSP here would not protect the
      // separately-hosted client, which sets its own headers.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // No Origin header: curl, health checks, same-origin, mobile app.
        if (!origin) return callback(null, true);
        if (config.cors.origins.includes(origin) || config.cors.origins.includes('*')) {
          return callback(null, true);
        }
        logger.warn('CORS origin rejected', { origin: origin.slice(0, 120) });
        return callback(new Error('Origin not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      maxAge: 86_400,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // Strips $ and . keys from req.body/query/params, blocking NoSQL injection
  // attempts such as {"email": {"$ne": null}}.
  app.use(mongoSanitize());

  if (!config.isTest) {
    app.use(
      morgan(':method :url :status :response-time ms', {
        stream: { write: (line: string) => logger.info(line.trim()) },
        skip: (req) => req.path === '/api/health',
      }),
    );
  }

  app.use('/api', globalLimiter);

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
