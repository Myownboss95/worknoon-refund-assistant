import { Controller, Get, Inject } from '@nestjs/common';
import type { Policy } from '@worknoon/contracts';
import { CONTRACTS, POLICY_MARKDOWN } from '../config/tokens.js';
import type { Contracts } from '../config/contracts.loader.js';

@Controller({ path: 'policy', version: '1' })
export class PolicyDocumentController {
  constructor(
    @Inject(CONTRACTS) private readonly contracts: Contracts,
    @Inject(POLICY_MARKDOWN) private readonly markdown: string,
  ) {}

  /** The policy document and the parsed policy.config.json that the rules read. */
  @Get()
  get(): Policy {
    return {
      version: this.contracts.policy.version,
      markdown: this.markdown,
      config: this.contracts.policy,
    };
  }
}
