import { Module } from '@nestjs/common';
import { AppConfig } from '../config/app-config.js';
import { CONTRACTS } from '../config/tokens.js';
import type { Contracts } from '../config/contracts.loader.js';
import { ReplyRenderer } from '../common/reply-renderer.js';
import { AiCallBudget } from './ai-call-budget.js';
import { AiCallRunner } from './ai-call-runner.js';
import { ClaudeRefundAnalyzer } from './claude-refund-analyzer.js';
import { InjectionDetector } from './guards/injection-detector.js';
import { ReplyGuard } from './guards/reply-guard.js';
import { MockRefundAnalyzer } from './mock-refund-analyzer.js';
import { loadSystemPrompts } from './prompts/prompts.js';
import { REFUND_ANALYZER, type RefundAnalyzer } from './refund-analyzer.js';

@Module({
  providers: [
    AiCallRunner,
    {
      provide: REFUND_ANALYZER,
      inject: [AppConfig, CONTRACTS, ReplyRenderer],
      useFactory: (
        config: AppConfig,
        contracts: Contracts,
        renderer: ReplyRenderer,
      ): RefundAnalyzer => {
        const { provider, apiKey, model } = config.llm;
        if (provider === 'anthropic' && apiKey !== undefined) {
          return new ClaudeRefundAnalyzer(
            { apiKey, model },
            loadSystemPrompts(contracts.path),
            new AiCallBudget(config.llmMaxCallsPerHour),
          );
        }
        return new MockRefundAnalyzer(contracts.mockFixtures, renderer);
      },
    },
    {
      provide: InjectionDetector,
      inject: [CONTRACTS],
      useFactory: (contracts: Contracts) => new InjectionDetector(contracts.injectionPatterns),
    },
    {
      provide: ReplyGuard,
      inject: [CONTRACTS],
      useFactory: (contracts: Contracts) => new ReplyGuard(contracts.replyGuard),
    },
  ],
  exports: [AiCallRunner, REFUND_ANALYZER, InjectionDetector, ReplyGuard],
})
export class AiModule {}
