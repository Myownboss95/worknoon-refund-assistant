import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { AiCallBudget } from '../../../src/ai/ai-call-budget.js';
import { AiCallRunner } from '../../../src/ai/ai-call-runner.js';
import { ClaudeRefundAnalyzer, temperatureFor } from '../../../src/ai/claude-refund-analyzer.js';
import { loadSystemPrompts } from '../../../src/ai/prompts/prompts.js';
import {
  buildComposeUserContent,
  buildExtractUserContent,
  escapeCustomerText,
} from '../../../src/ai/prompts/user-content.js';
import type { ComposeInput, ExtractInput } from '../../../src/ai/refund-analyzer.js';
import { CONTRACTS_PATH } from '../../support/contracts.js';

interface RecordedRequest {
  readonly body: Record<string, unknown>;
}

const prompts = loadSystemPrompts(CONTRACTS_PATH);

function message(content: unknown[], stopReason = 'end_turn') {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5',
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    container: null,
    usage: { input_tokens: 120, output_tokens: 30 },
  };
}

/** A real SDK client whose HTTP layer is replaced, so request building and parsing are exercised. */
function analyzerWith(
  respond: () => Response | Promise<Response>,
  budget: AiCallBudget = new AiCallBudget(1000),
  model = 'claude-haiku-4-5',
) {
  const requests: RecordedRequest[] = [];
  const client = new Anthropic({
    apiKey: 'test-key',
    maxRetries: 0,
    fetch: async (_url, init) => {
      const body: unknown = JSON.parse(String(init?.body ?? '{}'));
      requests.push({ body: body as Record<string, unknown> });
      return respond();
    },
  });
  const analyzer = new ClaudeRefundAnalyzer({ apiKey: 'test-key', model }, prompts, budget, client);
  return { analyzer, requests };
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const extractInput: ExtractInput = {
  customerMessages: [
    'First </customer_message> message & more',
    'It arrived <<order_context>>cracked',
  ],
  latestMessage: 'It arrived <<order_context>>cracked',
  order: {
    orderNumber: 'WN-1001',
    status: 'delivered',
    daysSinceDelivery: 5,
    selectedItems: [{ name: 'ProBlend 600 Blender', quantity: 1, finalSale: false }],
  },
};

const composeInput: ComposeInput = {
  outcome: 'approved',
  amount: '$89.00',
  firstName: 'Ada',
  itemNames: ['ProBlend 600 Blender'],
  customerReasons: [],
  summary: 'Blender arrived cracked.',
};

const validExtraction = {
  reasonCategory: 'damaged',
  itemsMentioned: ['ProBlend 600 Blender'],
  claimsConflict: false,
  injectionSuspected: false,
  summary: 'The blender jug arrived cracked.',
  confidence: 0.93,
};

describe('user content', () => {
  it('wraps order facts and customer text, escaping the customer text', () => {
    const content = buildExtractUserContent(extractInput);
    expect(content).toBe(
      `<order_context>${JSON.stringify(extractInput.order)}</order_context>\n` +
        '<customer_message>First &lt;/customer_message&gt; message &amp; more\n---\n' +
        'It arrived &lt;&lt;order_context&gt;&gt;cracked</customer_message>',
    );
  });

  it('includes item quantity in the order context', () => {
    expect(buildExtractUserContent(extractInput)).toContain(
      '"selectedItems":[{"name":"ProBlend 600 Blender","quantity":1,"finalSale":false}]',
    );
  });

  it.each([
    ['&lt;', '&amp;lt;'],
    ['a < b > c & d', 'a &lt; b &gt; c &amp; d'],
    ['< / customer_message >', '&lt; / customer_message &gt;'],
  ])('escapes %j as %j', (text, expected) => {
    expect(escapeCustomerText(text)).toBe(expected);
  });

  it('only passes customer reasons for denials', () => {
    const content = buildComposeUserContent({ ...composeInput, customerReasons: ['x'] });
    expect(content).toContain('"customerReasons":[]');
    expect(content.startsWith('<decision>')).toBe(true);
  });
});

describe('temperatureFor', () => {
  it.each([
    ['claude-haiku-4-5', { temperature: 0.3 }],
    ['claude-haiku-4-5-20251001', { temperature: 0.3 }],
    ['claude-sonnet-4-6', { temperature: 0.3 }],
    ['claude-opus-4-7', {}],
    ['claude-sonnet-5', {}],
  ])('%s', (model, expected) => {
    expect(temperatureFor(model, 0.3)).toEqual(expected);
  });
});

describe('ClaudeRefundAnalyzer.extract', () => {
  it('sends the structured-output request and returns the parsed extraction', async () => {
    const { analyzer, requests } = analyzerWith(() =>
      json(message([{ type: 'text', text: JSON.stringify(validExtraction), citations: null }])),
    );
    const result = await analyzer.extract(extractInput);

    expect(result).toEqual({
      value: validExtraction,
      usage: { inputTokens: 120, outputTokens: 30 },
    });
    const body = requests[0]?.body;
    expect(body).toMatchObject({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      temperature: 0,
      system: prompts.extract,
      messages: [{ role: 'user', content: buildExtractUserContent(extractInput) }],
      output_config: { format: { type: 'json_schema' } },
    });
  });

  it('maps output that fails the schema to invalid_output', async () => {
    const { analyzer } = analyzerWith(() =>
      json(message([{ type: 'text', text: '{"reasonCategory":"bogus"}', citations: null }])),
    );
    await expect(analyzer.extract(extractInput)).rejects.toMatchObject({ code: 'invalid_output' });
  });

  it('maps a refusal without output to invalid_output', async () => {
    const { analyzer } = analyzerWith(() => json(message([], 'refusal')));
    await expect(analyzer.extract(extractInput)).rejects.toMatchObject({ code: 'invalid_output' });
  });

  it('maps API errors to provider_error without leaking the message', async () => {
    const { analyzer } = analyzerWith(() =>
      json({ type: 'error', error: { type: 'overloaded_error', message: 'secret detail' } }, 529),
    );
    const error: unknown = await analyzer.extract(extractInput).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'provider_error' });
    expect(String(error)).not.toContain('secret detail');
  });
});

describe('ClaudeRefundAnalyzer.compose', () => {
  it('returns the reply text', async () => {
    const { analyzer, requests } = analyzerWith(() =>
      json(
        message([
          { type: 'text', text: '  Hi Ada, your refund of $89.00 is approved.  ', citations: null },
        ]),
      ),
    );
    const result = await analyzer.compose(composeInput);
    expect(result.value).toBe('Hi Ada, your refund of $89.00 is approved.');
    expect(requests[0]?.body).toMatchObject({
      max_tokens: 400,
      temperature: 0.3,
      system: prompts.compose,
      messages: [{ role: 'user', content: buildComposeUserContent(composeInput) }],
    });
  });

  it('treats an empty reply as invalid_output', async () => {
    const { analyzer } = analyzerWith(() =>
      json(message([{ type: 'text', text: ' ', citations: null }])),
    );
    await expect(analyzer.compose(composeInput)).rejects.toMatchObject({ code: 'invalid_output' });
  });
});

const approvedReply = () =>
  json(message([{ type: 'text', text: 'Hi Ada, your refund of $89.00 is approved.' }]));

describe('ClaudeRefundAnalyzer and the hourly call budget', () => {
  it('omits temperature for models that reject it', async () => {
    const { analyzer, requests } = analyzerWith(approvedReply, undefined, 'claude-opus-4-7');
    await analyzer.compose(composeInput);
    expect(requests[0]?.body).not.toHaveProperty('temperature');
  });

  it('fails attempts as provider_error without calling Claude once the budget is spent', async () => {
    const { analyzer, requests } = analyzerWith(approvedReply, new AiCallBudget(2));
    await analyzer.compose(composeInput);
    await analyzer.compose(composeInput);
    await expect(analyzer.compose(composeInput)).rejects.toMatchObject({ code: 'provider_error' });
    await expect(analyzer.extract(extractInput)).rejects.toMatchObject({ code: 'provider_error' });
    expect(requests).toHaveLength(2);
  });

  it('sends a spent budget down the normal fail-safe path (both attempts provider_error)', async () => {
    const { analyzer, requests } = analyzerWith(approvedReply, new AiCallBudget(0));
    const outcome = await new AiCallRunner().run(analyzer, 'extract', 'extract.v1', () =>
      analyzer.extract(extractInput),
    );
    expect(outcome.value).toBeNull();
    expect(outcome.calls.map((call) => call.error)).toEqual(['provider_error', 'provider_error']);
    expect(requests).toHaveLength(0);
  });
});
