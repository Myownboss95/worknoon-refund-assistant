import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env.schema.js';
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
    });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
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
