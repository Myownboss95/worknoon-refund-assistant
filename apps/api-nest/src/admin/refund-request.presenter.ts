import {
  DecisionTraceSchema,
  type AuditEvent,
  type RefundRequestDetail,
  type RefundRequestSummary,
} from '@worknoon/contracts';
import { z } from 'zod';
import { toMessage } from '../conversations/conversation.presenter.js';
import type { AuditEvent as AuditEventRow } from '../generated/prisma/client.js';
import { parseFlags, parseRuleIds } from '../refunds/stored-json.js';
import type { RefundRequestDetailRow, RefundRequestSummaryRow } from './admin.repository.js';

const AuditDataSchema = z.record(z.string(), z.unknown());

export function toRefundRequestSummary(row: RefundRequestSummaryRow): RefundRequestSummary {
  return {
    id: row.id,
    status: row.status,
    decidedBy: row.decidedBy === 'human' ? 'human' : 'policy',
    customer: { name: row.customer.name, email: row.customer.email },
    orderNumber: row.order.orderNumber,
    amountCents: row.amountCents,
    currency: row.currency,
    reasonCategory: row.reasonCategory,
    flags: parseFlags(row.flags),
    decisiveRuleIds: parseRuleIds(row.decisiveRuleIds),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    type: row.type,
    actor: row.actor,
    data: AuditDataSchema.parse(row.data),
    createdAt: row.createdAt.toISOString(),
  };
}

/** Assumes an assistant-created request (conversation and trace present); see AdminRepository. */
export function toRefundRequestDetail(
  row: RefundRequestDetailRow & {
    conversation: NonNullable<RefundRequestDetailRow['conversation']>;
  },
  auditEvents: readonly AuditEventRow[],
): RefundRequestDetail {
  const review =
    row.reviewDecision !== null && row.reviewedAt !== null
      ? {
          decision: row.reviewDecision,
          note: row.reviewNote ?? '',
          reviewer: row.reviewedBy ?? 'admin',
          reviewedAt: row.reviewedAt.toISOString(),
        }
      : null;
  return {
    ...toRefundRequestSummary(row),
    items: row.items.map((item) => ({
      orderItemId: item.orderItemId,
      sku: item.orderItem.sku,
      name: item.orderItem.name,
      quantity: item.orderItem.quantity,
      amountCents: item.amountCents,
      finalSale: item.orderItem.finalSale,
    })),
    conversation: { id: row.conversation.id, messages: row.conversation.messages.map(toMessage) },
    trace: DecisionTraceSchema.parse(row.trace),
    review,
    auditEvents: auditEvents.map(toAuditEvent),
  };
}
