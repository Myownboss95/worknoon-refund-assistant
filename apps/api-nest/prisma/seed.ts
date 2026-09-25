import { randomUUID } from 'node:crypto';
import { daysAgo } from '../src/common/time.js';
import type { ScenariosFile } from '../src/config/contracts.schema.js';
import { Prisma, type PrismaClient } from '../src/generated/prisma/client.js';
import type { Db } from '../src/prisma/database.types.js';

/**
 * Demo data from contracts/scenarios.json. Dates are relative to `now`, so the scenarios stay valid
 * whenever the seed runs. Used by the seed CLI (boot) and by POST /admin/demo/reset.
 */

export interface SeedSummary {
  readonly customers: number;
  readonly orders: number;
}

export interface SeedOptions {
  readonly currency: string;
  readonly now?: Date;
}

/** Every table, children first. */
const TABLES = [
  'audit_events',
  'refund_request_items',
  'refund_requests',
  'messages',
  'conversations',
  'order_items',
  'orders',
  'customers',
] as const;

export async function seedDatabase(
  db: Db,
  { customers }: ScenariosFile,
  { currency, now = new Date() }: SeedOptions,
): Promise<SeedSummary> {
  const customerRows: Prisma.CustomerCreateManyInput[] = [];
  const orderRows: Prisma.OrderCreateManyInput[] = [];
  const itemRows: Prisma.OrderItemCreateManyInput[] = [];
  const refundRows: Prisma.RefundRequestCreateManyInput[] = [];
  const refundItemRows: Prisma.RefundRequestItemCreateManyInput[] = [];

  for (const customer of customers) {
    const customerId = randomUUID();
    customerRows.push({
      id: customerId,
      name: customer.name,
      email: customer.email.toLowerCase(),
      createdAt: now,
    });

    const items = new Map<string, { id: string; orderId: string; lineTotalCents: number }>();
    for (const order of customer.orders) {
      const orderId = randomUUID();
      orderRows.push({
        id: orderId,
        customerId,
        orderNumber: order.orderNumber.toUpperCase(),
        status: order.status,
        placedAt: daysAgo(now, order.placedDaysAgo),
        deliveredAt: order.deliveredDaysAgo === null ? null : daysAgo(now, order.deliveredDaysAgo),
        createdAt: now,
      });
      for (const item of order.items) {
        const itemId = randomUUID();
        itemRows.push({ id: itemId, orderId, ...item });
        items.set(`${order.orderNumber}/${item.sku}`, {
          id: itemId,
          orderId,
          lineTotalCents: item.unitPriceCents * item.quantity,
        });
      }
    }

    for (const history of customer.refundHistory ?? []) {
      const item = items.get(`${history.orderNumber}/${history.sku}`);
      if (item === undefined) {
        throw new Error(
          `Refund history for ${customer.key} references unknown item ${history.sku}`,
        );
      }
      const refundRequestId = randomUUID();
      const createdAt = daysAgo(now, history.daysAgo);
      refundRows.push({
        id: refundRequestId,
        conversationId: null,
        customerId,
        orderId: item.orderId,
        status: history.status,
        decidedBy: 'import',
        reasonCategory: history.reasonCategory,
        amountCents: item.lineTotalCents,
        currency,
        decisiveRuleIds: [],
        flags: [],
        trace: Prisma.DbNull,
        createdAt,
        updatedAt: createdAt,
      });
      refundItemRows.push({
        refundRequestId,
        orderItemId: item.id,
        amountCents: item.lineTotalCents,
      });
    }
  }

  await db.customer.createMany({ data: customerRows });
  await db.order.createMany({ data: orderRows });
  await db.orderItem.createMany({ data: itemRows });
  await db.refundRequest.createMany({ data: refundRows });
  await db.refundRequestItem.createMany({ data: refundItemRows });
  return { customers: customerRows.length, orders: orderRows.length };
}

/** Truncates every table and seeds again, atomically. */
export function resetDatabase(
  prisma: PrismaClient,
  scenarios: ScenariosFile,
  options: SeedOptions,
): Promise<SeedSummary> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.join(', ')} CASCADE`);
    return seedDatabase(tx, scenarios, options);
  });
}

/** Seeds only when there are no customers yet (idempotent boot seed). */
export async function seedIfEmpty(
  prisma: PrismaClient,
  scenarios: ScenariosFile,
  options: SeedOptions,
): Promise<SeedSummary | null> {
  return prisma.$transaction(async (tx) => {
    if ((await tx.customer.count()) > 0) return null;
    return seedDatabase(tx, scenarios, options);
  });
}
