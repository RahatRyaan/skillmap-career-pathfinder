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

/**
 * Builds the API app.
 *
 * `attachClient` optionally serves a built SPA. It MUST be called before the
 * API's 404 handler, because that handler is terminal: anything reaching it
 * is already a miss, and a SPA fallback registered afterwards would never run.
 */
export function createApp(attachClient?: (app: Express) => void): Express {
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
        // No Origin header: curl, health checks, native clients.
        if (!origin) return callback(null, true);

        // Same-origin. A browser sends Origin on cross-origin fetches and on
        // same-origin POSTs, so an allow-list that omits the app's own origin
        // would break the app serving its own assets. Comparing the origin to
        // the request host lets the app always load itself, without opening
        // CORS to anything else.
        return callback(null, true);
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

  // CORS decision. `cors()` above stamps headers for the allow-list; this
  // rejects anything else with 403 rather than a generic 500.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) return next();
    if (config.cors.origins.includes('*') || config.cors.origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      return next();
    }
    // Same-origin: the Origin host matches the Host the request arrived on.
    try {
      if (new URL(origin).host === req.headers.host) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        return next();
      }
    } catch {
      // A malformed Origin is not same-origin.
    }
    logger.warn('CORS origin rejected', { origin: origin.slice(0, 120), path: req.path });
    res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'This origin is not allowed.', requestId: 'cors' },
    });
    return undefined;
  });

  app.use('/api', globalLimiter);

  registerRoutes(app);

  if (attachClient) attachClient(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
