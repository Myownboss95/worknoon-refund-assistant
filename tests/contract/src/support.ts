import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import type { z } from 'zod';
import {
  ErrorResponseSchema,
  RefundRequestDetailSchema,
  ResetResponseSchema,
  SendMessageResponseSchema,
  VerifyResponseSchema,
  type ErrorCode,
  type RefundRequestDetail,
  type SendMessageResponse,
  type VerifyResponse,
} from '@worknoon/contracts';

export const BACKEND = process.env.CONTRACT_BACKEND ?? 'laravel';
export const BASE_URL = (process.env.CONTRACT_BASE_URL ?? 'http://localhost:3002/api/v1').replace(
  /\/$/,
  '',
);
export const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? 'demo-admin';

const CONTRACTS_DIR = fileURLToPath(new URL('../../../contracts/', import.meta.url));

export const readContract = <T>(name: string): T =>
  JSON.parse(readFileSync(`${CONTRACTS_DIR}${name}`, 'utf8')) as T;

export interface Scenario {
  id: number;
  title: string;
  email: string;
  orderNumber: string;
  skus: string[];
  messages: string[];
  expected: {
    status: 'approved' | 'denied' | 'escalated';
    decisiveRuleIds: string[];
    amountCents: number;
    flags: string[];
    clarifications: number;
  };
}

export interface RedTeam {
  email: string;
  orderNumber: string;
  skus: string[];
  attacks: { id: string; text: string }[];
}

export const scenarios = readContract<{ scenarios: Scenario[] }>('scenarios.json').scenarios;
export const redTeam = readContract<RedTeam>('red-team.json');

export interface RawResponse {
  status: number;
  body: unknown;
}

export const request = async (
  method: 'GET' | 'POST',
  path: string,
  options: { body?: unknown; admin?: boolean; token?: string; rawBody?: string } = {},
): Promise<RawResponse> => {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined || options.rawBody !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.admin) headers['X-Admin-Token'] = options.token ?? ADMIN_TOKEN;

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text === '' ? null : JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
};

/** Asserts the status and parses the body with the contract schema, failing with a readable diff. */
export const expectOk = <S extends z.ZodType>(res: RawResponse, status: number, schema: S): z.infer<S> => {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  const parsed = schema.safeParse(res.body);
  if (!parsed.success) {
    throw new Error(
      `Response does not match the contract schema:\n${JSON.stringify(parsed.error.issues, null, 2)}\nBody: ${JSON.stringify(res.body, null, 2)}`,
    );
  }
  return parsed.data;
};

export const expectError = (res: RawResponse, status: number, code: ErrorCode) => {
  expect(res.status, JSON.stringify(res.body)).toBe(status);
  const parsed = ErrorResponseSchema.safeParse(res.body);
  expect(parsed.success, `error shape: ${JSON.stringify(res.body)}`).toBe(true);
  expect(parsed.data?.error.code).toBe(code);
  return parsed.data!.error;
};

export const resetDemo = async () => {
  const res = await request('POST', '/admin/demo/reset', { admin: true });
  return expectOk(res, 200, ResetResponseSchema);
};

export const verify = async (email: string, orderNumber: string): Promise<VerifyResponse> =>
  expectOk(
    await request('POST', '/customers/verify', { body: { email, orderNumber } }),
    201,
    VerifyResponseSchema,
  );

export const itemIdsFor = (verified: VerifyResponse, skus: string[]): string[] =>
  skus.map((sku) => {
    const item = verified.order.items.find((i) => i.sku === sku);
    if (!item) throw new Error(`Order ${verified.order.orderNumber} has no item ${sku}`);
    return item.id;
  });

export const send = async (
  conversationId: string,
  text: string,
  itemIds: string[],
): Promise<SendMessageResponse> =>
  expectOk(
    await request('POST', `/conversations/${conversationId}/messages`, { body: { text, itemIds } }),
    200,
    SendMessageResponseSchema,
  );

export const detail = async (refundRequestId: string): Promise<RefundRequestDetail> =>
  expectOk(
    await request('GET', `/admin/refund-requests/${refundRequestId}`, { admin: true }),
    200,
    RefundRequestDetailSchema,
  );

/** Runs a scenario's messages in order and returns every response. */
export const playScenario = async (scenario: Scenario) => {
  const verified = await verify(scenario.email, scenario.orderNumber);
  const itemIds = itemIdsFor(verified, scenario.skus);
  const replies: SendMessageResponse[] = [];
  for (const text of scenario.messages) {
    replies.push(await send(verified.conversation.id, text, itemIds));
  }
  return { verified, itemIds, replies, last: replies[replies.length - 1]! };
};
