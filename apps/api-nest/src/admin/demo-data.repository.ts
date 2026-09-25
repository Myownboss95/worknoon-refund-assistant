import { Inject, Injectable } from '@nestjs/common';
import { resetDatabase, type SeedSummary } from '../../prisma/seed.js';
import { CONTRACTS } from '../config/tokens.js';
import type { Contracts } from '../config/contracts.loader.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DemoDataRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONTRACTS) private readonly contracts: Contracts,
  ) {}

  /** Truncates every table and re-seeds contracts/scenarios.json relative to now. */
  reset(): Promise<SeedSummary> {
    return resetDatabase(this.prisma, this.contracts.scenarios, {
      currency: this.contracts.policy.currency,
    });
  }
}
