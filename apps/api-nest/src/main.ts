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
