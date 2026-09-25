import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AiProvider } from '@worknoon/contracts';
import { isWeakAdminToken, type Env } from './env.schema.js';
import { resolveContractsPath, resolvePolicyDocPath } from './paths.js';

export interface LlmSettings {
  /** The provider actually in use: `anthropic` without an API key falls back to `mock`. */
  readonly provider: AiProvider;
  readonly model: string;
  readonly apiKey: string | undefined;
}

/** Typed, resolved view of the validated environment. */
@Injectable()
export class AppConfig {
  readonly port: number;
  readonly databaseUrl: string;
  readonly adminToken: string;
  /** Enables POST /admin/demo/reset and tolerates the well-known demo admin token. */
  readonly demoMode: boolean;
  /** IPs/CIDRs whose X-Forwarded-For is honoured; empty trusts no proxy. */
  readonly trustedProxies: readonly string[];
  readonly corsOrigin: string;
  readonly rateLimitVerifyPerMinute: number;
  readonly rateLimitMessagesPerMinute: number;
  readonly rateLimitAdminFailuresPerMinute: number;
  readonly maxConversationsPerOrderPerDay: number;
  readonly llmMaxCallsPerHour: number;
  readonly contractsPath: string;
  readonly policyDocPath: string;
  readonly llm: LlmSettings;

  constructor(config: ConfigService<Env, true>) {
    this.port = config.get('PORT', { infer: true });
    this.databaseUrl = config.get('DATABASE_URL', { infer: true });
    this.adminToken = config.get('ADMIN_TOKEN', { infer: true });
    this.demoMode = config.get('DEMO_MODE', { infer: true });
    this.trustedProxies = config.get('TRUSTED_PROXIES', { infer: true });
    this.corsOrigin = config.get('CORS_ORIGIN', { infer: true });
    this.rateLimitVerifyPerMinute = config.get('RATE_LIMIT_VERIFY_PER_MINUTE', { infer: true });
    this.rateLimitMessagesPerMinute = config.get('RATE_LIMIT_MESSAGES_PER_MINUTE', { infer: true });
    this.rateLimitAdminFailuresPerMinute = config.get('RATE_LIMIT_ADMIN_FAILURES_PER_MINUTE', {
      infer: true,
    });
    this.maxConversationsPerOrderPerDay = config.get('MAX_CONVERSATIONS_PER_ORDER_PER_DAY', {
      infer: true,
    });
    this.llmMaxCallsPerHour = config.get('LLM_MAX_CALLS_PER_HOUR', { infer: true });
    this.contractsPath = resolveContractsPath(config.get('CONTRACTS_PATH', { infer: true }));
    this.policyDocPath = resolvePolicyDocPath(config.get('POLICY_DOC_PATH', { infer: true }));

    const apiKey = config.get('ANTHROPIC_API_KEY', { infer: true });
    const wantsAnthropic = config.get('LLM_PROVIDER', { infer: true }) === 'anthropic';
    this.llm =
      wantsAnthropic && apiKey
        ? { provider: 'anthropic', model: config.get('LLM_MODEL', { infer: true }), apiKey }
        : { provider: 'mock', model: 'mock', apiKey: undefined };
  }

  /** The demo token or one under 32 characters; only tolerated outside production or in demo mode. */
  get adminTokenIsWeak(): boolean {
    return isWeakAdminToken(this.adminToken);
  }
}
