import { readFileSync } from 'node:fs';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReplyRenderer } from '../common/reply-renderer.js';
import { AppConfig } from './app-config.js';
import { loadContracts, type Contracts } from './contracts.loader.js';
import { EnvSchema } from './env.schema.js';
import { CONTRACTS, POLICY_MARKDOWN } from './tokens.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: EnvSchema,
    }),
  ],
  providers: [
    AppConfig,
    {
      provide: CONTRACTS,
      inject: [AppConfig],
      useFactory: (config: AppConfig): Contracts => loadContracts(config.contractsPath),
    },
    {
      provide: ReplyRenderer,
      inject: [CONTRACTS],
      useFactory: (contracts: Contracts): ReplyRenderer =>
        new ReplyRenderer(contracts.templates, contracts.policy),
    },
    {
      provide: POLICY_MARKDOWN,
      inject: [AppConfig],
      useFactory: (config: AppConfig): string => readFileSync(config.policyDocPath, 'utf8'),
    },
  ],
  exports: [AppConfig, CONTRACTS, POLICY_MARKDOWN, ReplyRenderer],
})
export class AppConfigModule {}
