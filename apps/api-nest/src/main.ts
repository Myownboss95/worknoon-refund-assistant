import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { AppConfig } from './config/app-config.js';

async function bootstrap(): Promise<void> {
  const logger = new ConsoleLogger({ json: true, colors: false });
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule, { logger }));
  const config = app.get(AppConfig);
  if (config.demoMode && config.adminTokenIsWeak) {
    // Production without DEMO_MODE refuses to boot with a weak token (env.schema.ts); never log it.
    logger.warn(
      { event: 'weak_admin_token', message: 'DEMO_MODE is on and ADMIN_TOKEN is weak.' },
      'Bootstrap',
    );
  }
  await app.listen(config.port, '0.0.0.0');
  logger.log(
    {
      event: 'started',
      port: config.port,
      llmProvider: config.llm.provider,
      llmModel: config.llm.model,
    },
    'Bootstrap',
  );
}

void bootstrap();
