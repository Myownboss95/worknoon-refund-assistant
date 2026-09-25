import { describe, expect, it } from 'vitest';
import { isWeakAdminToken, parseEnv } from '../../src/config/env.schema.js';
import { ReplyRenderer } from '../../src/common/reply-renderer.js';
import { contracts } from '../support/contracts.js';

const DATABASE_URL = 'postgresql://refunds:refunds@localhost:55432/refunds_nest';

describe('parseEnv', () => {
  it('applies defaults, treating empty strings as unset', () => {
    const env = parseEnv({ DATABASE_URL, ANTHROPIC_API_KEY: '', PORT: '' });
    expect(env).toMatchObject({
      PORT: 3001,
      LLM_PROVIDER: 'mock',
      LLM_MODEL: 'claude-haiku-4-5',
      ADMIN_TOKEN: 'demo-admin',
      CORS_ORIGIN: 'http://localhost:8080',
      RATE_LIMIT_VERIFY_PER_MINUTE: 60,
      RATE_LIMIT_MESSAGES_PER_MINUTE: 60,
      DEMO_MODE: false,
      TRUSTED_PROXIES: [],
      RATE_LIMIT_ADMIN_FAILURES_PER_MINUTE: 20,
      MAX_CONVERSATIONS_PER_ORDER_PER_DAY: 20,
      LLM_MAX_CALLS_PER_HOUR: 1000,
    });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it('parses DEMO_MODE as a boolean and TRUSTED_PROXIES as a list', () => {
    const env = parseEnv({
      DATABASE_URL,
      DEMO_MODE: 'true',
      TRUSTED_PROXIES: ' 172.28.0.10, 10.0.0.0/8 ,,::1 ',
    });
    expect(env.DEMO_MODE).toBe(true);
    expect(env.TRUSTED_PROXIES).toEqual(['172.28.0.10', '10.0.0.0/8', '::1']);
    expect(parseEnv({ DATABASE_URL, DEMO_MODE: 'false' }).DEMO_MODE).toBe(false);
  });

  it.each(['loopback', '10.0.0.0/33', '300.1.1.1', '10.0.0.1/8/1'])(
    'rejects TRUSTED_PROXIES entry %s',
    (entry) => {
      expect(() => parseEnv({ DATABASE_URL, TRUSTED_PROXIES: entry })).toThrow(/TRUSTED_PROXIES/);
    },
  );

  describe('admin token boot check', () => {
    const production = { DATABASE_URL, NODE_ENV: 'production' };
    const strong = 'x'.repeat(32);

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['the demo token', 'demo-admin'],
      ['shorter than 32 characters', 'short-but-secret-token-31-chars'],
    ])('refuses to boot in production without demo mode when it is %s', (_case, token) => {
      expect(() => parseEnv({ ...production, ADMIN_TOKEN: token })).toThrow(/ADMIN_TOKEN/);
    });

    it('never prints the token value', () => {
      const secret = 'short-but-secret-token-31-chars';
      expect(() => parseEnv({ ...production, ADMIN_TOKEN: secret })).not.toThrow(secret);
    });

    it('accepts a strong token in production', () => {
      expect(parseEnv({ ...production, ADMIN_TOKEN: strong }).ADMIN_TOKEN).toBe(strong);
    });

    it('allows a weak token in demo mode or outside production', () => {
      expect(() => parseEnv({ ...production, DEMO_MODE: 'true' })).not.toThrow();
      expect(() => parseEnv({ DATABASE_URL, ADMIN_TOKEN: 'short' })).not.toThrow();
    });
  });

  it('flags weak admin tokens', () => {
    expect(isWeakAdminToken(undefined)).toBe(true);
    expect(isWeakAdminToken('demo-admin')).toBe(true);
    expect(isWeakAdminToken('x'.repeat(31))).toBe(true);
    expect(isWeakAdminToken('x'.repeat(32))).toBe(false);
  });

  it('fails fast listing every problem', () => {
    expect(() => parseEnv({ PORT: 'abc', LLM_PROVIDER: 'openai' })).toThrow(
      /DATABASE_URL.*PORT.*LLM_PROVIDER/,
    );
  });
});

describe('contracts', () => {
  it('load and validate', () => {
    expect(contracts.policy.version).toBe('1.0');
    expect(contracts.scenarios.scenarios).toHaveLength(15);
  });
});

describe('ReplyRenderer', () => {
  const renderer = new ReplyRenderer(contracts.templates, contracts.policy);

  it('fills policy placeholders in customer reasons', () => {
    expect(renderer.customerReasons(['R09', 'R08'])).toEqual([
      'Change-of-mind refunds are available for 14 days after delivery, and that window has passed.',
    ]);
  });

  it('describes decisions for the customer', () => {
    expect(renderer.decisionReason('approved', 8900, ['R08'])).toBe(
      'Your refund of $89.00 has been approved.',
    );
    expect(renderer.decisionReason('escalated', 8900, ['R06'])).toBe(
      'A member of our support team will review your request within one business day.',
    );
    expect(renderer.decisionReason('denied', 4500, ['R03'])).toBe(
      'It was delivered more than 30 days ago, which is outside our refund window.',
    );
    expect(renderer.decisionReason('denied', 4500, ['R02', 'R03'])).toBe(
      "This order hasn't been delivered yet, so it can't be refunded. You can cancel it instead from your order page before it ships. It was delivered more than 30 days ago, which is outside our refund window.",
    );
    expect(renderer.decisionReason('denied', 4500, [])).toBe(
      "After reviewing your request, we're unable to offer a refund.",
    );
    expect(renderer.decisionReason('denied', 8500, ['R04'], 'human')).toBe(
      "After reviewing your request, we're unable to offer a refund.",
    );
  });

  it('renders the clarification question with joined item names', () => {
    expect(renderer.clarify('Ngozi', ['Oak Side Table', 'Ceramic Table Lamp'])).toContain(
      'To help with your Oak Side Table and Ceramic Table Lamp,',
    );
  });
});
