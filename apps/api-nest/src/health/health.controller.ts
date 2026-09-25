import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Health } from '@worknoon/contracts';
import type { Response } from 'express';
import { REFUND_ANALYZER, type RefundAnalyzer } from '../ai/refund-analyzer.js';
import { CONTRACTS } from '../config/tokens.js';
import type { Contracts } from '../config/contracts.loader.js';
import { HealthRepository } from './health.repository.js';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly health: HealthRepository,
    @Inject(REFUND_ANALYZER) private readonly analyzer: RefundAnalyzer,
    @Inject(CONTRACTS) private readonly contracts: Contracts,
  ) {}

  /** 200 `ok` when the database answers, else 503 `degraded`. */
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<Health> {
    const databaseUp = await this.health.ping();
    res.status(databaseUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: databaseUp ? 'ok' : 'degraded',
      backend: 'nest',
      database: databaseUp ? 'ok' : 'down',
      ai: { provider: this.analyzer.provider, model: this.analyzer.model },
      policyVersion: this.contracts.policy.version,
      time: new Date().toISOString(),
    };
  }
}
