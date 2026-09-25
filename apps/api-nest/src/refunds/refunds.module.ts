import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module.js';
import { RefundPipelineService } from './refund-pipeline.service.js';
import { RefundsRepository } from './refunds.repository.js';

@Module({
  imports: [AiModule],
  providers: [RefundPipelineService, RefundsRepository],
  exports: [RefundPipelineService, RefundsRepository],
})
export class RefundsModule {}
