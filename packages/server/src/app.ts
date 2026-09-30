/**
 * Express application assembly.
 *
 * Kept separate from index.ts so tests can mount the app without binding a port
 * or opening a database connection.
 */

import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
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
/**
 * Same-origin check: the Origin host must equal the Host the request arrived
 * on. An https Origin is not same-origin with an http request, so the scheme
 * matters as soon as TLS termination sits in front.
 */
function isSameOrigin(origin: string, host: string | undefined): boolean {
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}

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

  /**
   * CORS.
   *
   * One implementation, because a permissive `cors()` callback plus a
   * hand-rolled check was reflecting every origin.
   *
   * Allowed when the origin is in CORS_ORIGINS, or when it is same-origin:
   * the browser sends Origin on cross-origin fetches and on same-origin
   * POSTs, so a check that omits the app's own host would stop the server
   * from serving its own assets. Anything else is refused with 403.
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin) return next();

    const isAllowed =
      config.cors.origins.includes('*') ||
      config.cors.origins.includes(origin) ||
      isSameOrigin(origin, req.headers.host);

    if (!isAllowed) {
      logger.warn('CORS origin rejected', { origin: origin.slice(0, 120), path: req.path });
      res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'This origin is not allowed.', requestId: 'cors' },
      });
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.status(204).send();
      return;
    }
    return next();
  });

  app.use('/api', globalLimiter);

  registerRoutes(app);

  if (attachClient) attachClient(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
