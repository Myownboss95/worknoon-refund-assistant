import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import {
  SendMessageResponseSchema,
  VerifyResponseSchema,
  type SendMessageResponse,
  type VerifyResponse,
} from '@worknoon/contracts';
import request from 'supertest';
import { expect } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { configureApp } from '../../../src/app.setup.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

export type Http = ReturnType<typeof request>;

export const ADMIN_TOKEN = 'test-admin-token';
export const API = '/api/v1';

export interface TestApp {
  readonly app: NestExpressApplication;
  readonly http: Http;
  readonly prisma: PrismaService;
  close(): Promise<void>;
}

/** Boots the real AppModule (optionally with overridden providers) exactly as main.ts configures it. */
export async function createTestApp(
  customise: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<TestApp> {
  const moduleRef = await customise(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
  return {
    app,
    http: request(app.getHttpServer()),
    prisma: app.get(PrismaService),
    close: () => app.close(),
  };
}

export async function resetDemo(http: Http): Promise<void> {
  await http.post(`${API}/admin/demo/reset`).set('X-Admin-Token', ADMIN_TOKEN).expect(200);
}

export async function verify(
  http: Http,
  email: string,
  orderNumber: string,
): Promise<VerifyResponse> {
  const response = await http.post(`${API}/customers/verify`).send({ email, orderNumber });
  expect(response.status).toBe(201);
  return VerifyResponseSchema.parse(response.body);
}

export function itemIdsFor(verified: VerifyResponse, skus: readonly string[]): string[] {
  return skus.map((sku) => {
    const item = verified.order.items.find((candidate) => candidate.sku === sku);
    if (item === undefined) throw new Error(`No item ${sku} on ${verified.order.orderNumber}`);
    return item.id;
  });
}

export async function sendMessage(
  http: Http,
  conversationId: string,
  text: string,
  itemIds: readonly string[],
): Promise<SendMessageResponse> {
  const response = await http
    .post(`${API}/conversations/${conversationId}/messages`)
    .send({ text, itemIds });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
  return SendMessageResponseSchema.parse(response.body);
}
