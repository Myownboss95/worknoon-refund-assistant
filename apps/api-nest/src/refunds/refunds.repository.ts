import { Injectable } from '@nestjs/common';
import type { DecisionTrace, Extraction, Flag, RefundStatus } from '@worknoon/contracts';
import { z } from 'zod';
import type { RuleId } from '../config/contracts.schema.js';
import { AuditRepository } from '../audit/audit.repository.js';
import {
  Prisma,
  type Conversation,
  type Message,
  type RefundRequest,
} from '../generated/prisma/client.js';
import type { ItemRefundStatus } from '../policy/types.js';
import type { Db } from '../prisma/database.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CONVERSATION_FOR_MESSAGE = {
  customer: true,
  order: { include: { items: { orderBy: [{ sku: 'asc' }, { id: 'asc' }] } } },
  messages: { where: { role: 'customer' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ConversationInclude;

export type ConversationForMessage = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_FOR_MESSAGE;
}>;

export interface NewRefundDecision {
  readonly conversationId: string;
  readonly customerId: string;
  readonly orderId: string;
  readonly status: RefundStatus;
  readonly reasonCategory: Extraction['reasonCategory'] | null;
  readonly amountCents: number;
  readonly currency: string;
  readonly decisiveRuleIds: readonly RuleId[];
  readonly flags: readonly Flag[];
  readonly trace: DecisionTrace;
  readonly items: readonly { readonly orderItemId: string; readonly amountCents: number }[];
  /** Items that were already approved or pending when the facts were read. */
  readonly previouslyClaimedItemIds: readonly string[];
  readonly reply: { readonly content: string; readonly createdAt: Date };
}

export type PersistDecisionResult =
  | {
      readonly ok: true;
      readonly refundRequest: RefundRequest;
      readonly reply: Message;
      readonly conversation: Conversation;
    }
  | { readonly ok: false; readonly reason: 'conversation_closed' | 'items_claimed' };

class PersistConflict extends Error {
  constructor(readonly reason: 'conversation_closed' | 'items_claimed') {
    super(reason);
  }
}

const LockedConversationSchema = z.array(z.object({ status: z.string() }));
const TurnClaimSchema = z.array(z.object({ lockedUntil: z.date() }));

export type TurnClaim =
  | { readonly ok: true; readonly lockedUntil: Date }
  | { readonly ok: false; readonly reason: 'conversation_closed' | 'busy' };
const CLAIMING_STATUSES = ['approved', 'escalated'] as const satisfies readonly RefundStatus[];

/** Reads and writes for the refund pipeline: conversations, messages, refund requests. */
@Injectable()
export class RefundsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditRepository,
  ) {}

  findConversationForMessage(id: string): Promise<ConversationForMessage | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: CONVERSATION_FOR_MESSAGE,
    });
  }

  /**
   * Claims the conversation for one message turn (docs/pipeline.md, "one turn at a time"): a single
   * conditional UPDATE, so of two concurrent turns exactly one wins. The 90 s expiry covers workers
   * that crash mid-turn: an expired lock is simply reclaimed.
   */
  async claimTurn(conversationId: string): Promise<TurnClaim> {
    const rows = TurnClaimSchema.parse(
      await this.prisma.$queryRaw`
        UPDATE conversations
        SET locked_until = now() + interval '90 seconds', updated_at = now()
        WHERE id = ${conversationId}::uuid AND status = 'open'
          AND (locked_until IS NULL OR locked_until < now())
        RETURNING locked_until AS "lockedUntil"`,
    );
    const claimed = rows[0];
    if (claimed !== undefined) return { ok: true, lockedUntil: claimed.lockedUntil };
    const current = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { status: true },
    });
    return {
      ok: false,
      reason: current === null || current.status === 'closed' ? 'conversation_closed' : 'busy',
    };
  }

  /** Ends the turn. Only clears this turn's own lock, in case it outlived the expiry and was re-claimed. */
  async releaseTurn(conversationId: string, lockedUntil: Date): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, lockedUntil },
      data: { lockedUntil: null },
    });
  }

  storeCustomerMessage(
    conversationId: string,
    content: string,
    itemIds: readonly string[],
  ): Promise<Message> {
    return this.prisma.message.create({
      data: {
        conversationId,
        role: 'customer',
        content,
        itemIds: [...itemIds],
        createdAt: new Date(),
      },
    });
  }

  /**
   * `approved` if an approved request covers the item, else `pending` if an escalated one does.
   * Denied requests do not block a new attempt.
   */
  async itemRefundStates(
    itemIds: readonly string[],
    db: Db = this.prisma,
  ): Promise<Map<string, ItemRefundStatus>> {
    const states = new Map<string, ItemRefundStatus>();
    if (itemIds.length === 0) return states;
    const rows = await db.refundRequestItem.findMany({
      where: {
        orderItemId: { in: [...itemIds] },
        refundRequest: { status: { in: [...CLAIMING_STATUSES] } },
      },
      select: { orderItemId: true, refundRequest: { select: { status: true } } },
    });
    for (const row of rows) {
      const state = row.refundRequest.status === 'approved' ? 'approved' : 'pending';
      if (states.get(row.orderItemId) !== 'approved') states.set(row.orderItemId, state);
    }
    return states;
  }

  countApprovedSince(customerId: string, since: Date): Promise<number> {
    return this.prisma.refundRequest.count({
      where: { customerId, status: 'approved', createdAt: { gte: since } },
    });
  }

  latestForConversation(conversationId: string): Promise<RefundRequest | null> {
    return this.prisma.refundRequest.findFirst({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  /** Increments the clarification counter of an open conversation; `null` if it is closed. */
  async incrementClarificationTurns(conversationId: string): Promise<number | null> {
    const { count } = await this.prisma.conversation.updateMany({
      where: { id: conversationId, status: 'open' },
      data: { clarificationTurns: { increment: 1 } },
    });
    if (count === 0) return null;
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { clarificationTurns: true },
    });
    return conversation.clarificationTurns;
  }

  async saveClarificationReply(
    conversationId: string,
    content: string,
    createdAt: Date,
    clarificationTurns: number,
  ): Promise<Message> {
    return this.prisma.$transaction(async (tx) => {
      const reply = await tx.message.create({
        data: { conversationId, role: 'assistant', content, createdAt },
      });
      await this.audit.record(
        {
          type: 'conversation.clarification_requested',
          actor: 'system',
          conversationId,
          data: { clarificationTurns },
          createdAt,
        },
        tx,
      );
      return reply;
    });
  }

  /**
   * Stores the decision, its items, the reply and the audit event, and closes the conversation, in
   * one transaction. The conversation and the selected items are locked first; if another request
   * closed the conversation or claimed one of the items since the facts were read, nothing is written.
   */
  async persistDecision(input: NewRefundDecision): Promise<PersistDecisionResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.lockOpenConversation(tx, input.conversationId);
        await this.assertItemsStillUnclaimed(tx, input);

        const refundRequest = await tx.refundRequest.create({
          data: {
            conversationId: input.conversationId,
            customerId: input.customerId,
            orderId: input.orderId,
            status: input.status,
            decidedBy: 'policy',
            reasonCategory: input.reasonCategory,
            amountCents: input.amountCents,
            currency: input.currency,
            decisiveRuleIds: [...input.decisiveRuleIds],
            flags: [...input.flags],
            trace: input.trace,
            createdAt: input.reply.createdAt,
            items: { create: input.items.map((item) => ({ ...item })) },
          },
        });
        const reply = await tx.message.create({
          data: {
            conversationId: input.conversationId,
            role: 'assistant',
            content: input.reply.content,
            createdAt: input.reply.createdAt,
          },
        });
        const conversation = await tx.conversation.update({
          where: { id: input.conversationId },
          data: { status: 'closed' },
        });
        await this.audit.record(
          {
            type: 'refund.decided',
            actor: 'system',
            conversationId: input.conversationId,
            refundRequestId: refundRequest.id,
            data: {
              status: input.status,
              decisiveRuleIds: [...input.decisiveRuleIds],
              flags: [...input.flags],
              amountCents: input.amountCents,
            },
            createdAt: input.reply.createdAt,
          },
          tx,
        );
        return { ok: true as const, refundRequest, reply, conversation };
      });
    } catch (error) {
      if (error instanceof PersistConflict) return { ok: false, reason: error.reason };
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { ok: false, reason: 'items_claimed' };
      }
      throw error;
    }
  }

  private async lockOpenConversation(tx: Db, conversationId: string): Promise<void> {
    const rows = LockedConversationSchema.parse(
      await tx.$queryRaw`SELECT status::text AS status FROM conversations WHERE id = ${conversationId}::uuid FOR UPDATE`,
    );
    if (rows[0]?.status !== 'open') throw new PersistConflict('conversation_closed');
  }

  private async assertItemsStillUnclaimed(tx: Db, input: NewRefundDecision): Promise<void> {
    const itemIds = input.items.map((item) => item.orderItemId).sort();
    await tx.$queryRaw`SELECT id FROM order_items WHERE id = ANY(${itemIds}::uuid[]) ORDER BY id FOR UPDATE`;
    const states = await this.itemRefundStates(itemIds, tx);
    const previouslyClaimed = new Set(input.previouslyClaimedItemIds);
    if ([...states.keys()].some((itemId) => !previouslyClaimed.has(itemId))) {
      throw new PersistConflict('items_claimed');
    }
  }
}
