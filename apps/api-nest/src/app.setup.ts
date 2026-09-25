import { VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { requestIdMiddleware } from './common/request-id.middleware.js';
import { AppConfig } from './config/app-config.js';

/** HTTP concerns shared by main.ts and the e2e tests, so tests exercise the real configuration. */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  const config = app.get(AppConfig);
  // Behind the web nginx proxy and Docker networking; trust private hops for the client IP.
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
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
