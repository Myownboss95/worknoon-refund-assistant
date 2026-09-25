import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { AppConfig } from './config/app-config.js';

/** HTTP concerns shared by main.ts and the e2e tests, so tests exercise the real configuration. */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(AppConfig);
  // Only TRUSTED_PROXIES (the web nginx in Compose) may set X-Forwarded-For; by default nothing is
  // trusted and req.ip, which every rate limit keys on, is the socket address.
  app.set('trust proxy', config.trustedProxies.length > 0 ? [...config.trustedProxies] : false);
  app.use(requestIdMiddleware);
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigin,
    allowedHeaders: ['Content-Type', 'X-Admin-Token', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.enableShutdownHooks();
  return app;
}
