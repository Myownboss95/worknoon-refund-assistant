import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { HealthController } from './health.controller.js';
import { HealthRepository } from './health.repository.js';

@Module({
  imports: [AiModule],
  controllers: [HealthController],
  providers: [HealthRepository],
})
export class HealthModule {}
