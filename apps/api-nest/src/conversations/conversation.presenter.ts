import type { ConversationSummary, Decision, Message, Order, OrderItem } from '@worknoon/contracts';
import { firstName } from '../common/formatting.js';
import type { ReplyRenderer } from '../common/reply-renderer.js';
import type {
  Conversation as ConversationRow,
  Message as MessageRow,
  Order as OrderRow,
  OrderItem as OrderItemRow,
  RefundRequest as RefundRequestRow,
} from '../generated/prisma/client.js';
import type { ItemRefundStatus } from '../policy/types.js';
import { parseItemIds, parseRuleIds } from '../refunds/stored-json.js';

/** Pure mappers from database rows to the wire shapes in contracts/openapi.yaml. */

export const lineTotalCents = (item: Pick<OrderItemRow, 'unitPriceCents' | 'quantity'>): number =>
  item.unitPriceCents * item.quantity;

export function toOrderItem(item: OrderItemRow, refundStatus: ItemRefundStatus): OrderItem {
  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    lineTotalCents: lineTotalCents(item),
    finalSale: item.finalSale,
    refundStatus,
  };
}

export function toOrder(
  order: OrderRow & { items: OrderItemRow[] },
  refundStates: ReadonlyMap<string, ItemRefundStatus>,
  currency: string,
): Order {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.placedAt.toISOString(),
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    totalCents: order.items.reduce((sum, item) => sum + lineTotalCents(item), 0),
    currency,
    items: order.items.map((item) => toOrderItem(item, refundStates.get(item.id) ?? null)),
  };
}

export function toMessage(message: MessageRow): Message {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    itemIds: parseItemIds(message.itemIds),
    createdAt: message.createdAt.toISOString(),
  };
}

export function toConversationSummary(conversation: ConversationRow): ConversationSummary {
  return {
    id: conversation.id,
    status: conversation.status,
    clarificationTurns: conversation.clarificationTurns,
    createdAt: conversation.createdAt.toISOString(),
  };
}

export function toCustomerName(name: string): { name: string; firstName: string } {
  return { name, firstName: firstName(name) };
}

/** The customer-safe decision. Imported history has no conversation and is never shown here. */
export function toDecision(request: RefundRequestRow, renderer: ReplyRenderer): Decision {
  const decisiveRuleIds = parseRuleIds(request.decisiveRuleIds);
  const decidedBy = request.decidedBy === 'human' ? 'human' : 'policy';
  return {
    refundRequestId: request.id,
    status: request.status,
    decidedBy,
    amountCents: request.amountCents,
    currency: request.currency,
    decisiveRuleIds,
    customerReason: renderer.decisionReason(
      request.status,
      request.amountCents,
      decisiveRuleIds,
      decidedBy,
    ),
  };
}
