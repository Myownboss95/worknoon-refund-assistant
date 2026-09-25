import { Injectable } from '@nestjs/common';
import { AuditRepository } from '../audit/audit.repository.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CONVERSATION_DETAIL = {
  customer: true,
  order: { include: { items: { orderBy: [{ sku: 'asc' }, { id: 'asc' }] } } },
  messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.ConversationInclude;

export type ConversationDetailRow = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_DETAIL;
}>;

export interface StartConversationInput {
  readonly customerId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly greeting: string;
  /** Refuse to start if the order already has this many conversations created since `since`. */
  readonly cap: { readonly max: number; readonly since: Date };
}

@Injectable()
export class ConversationsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditRepository,
  ) {}

  findDetail(id: string): Promise<ConversationDetailRow | null> {
    return this.prisma.conversation.findUnique({ where: { id }, include: CONVERSATION_DETAIL });
  }

  /**
   * Opens a conversation with its greeting and records `conversation.started`, atomically. Returns
   * `null` and writes nothing when the order is at its conversation cap. The order row is locked
   * first so concurrent verifications cannot both pass the cap.
   */
  async start(input: StartConversationInput): Promise<ConversationDetailRow | null> {
    const conversationId = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${input.orderId}::uuid FOR UPDATE`;
      const recent = await tx.conversation.count({
        where: { orderId: input.orderId, createdAt: { gte: input.cap.since } },
      });
      if (recent >= input.cap.max) return null;
      const createdAt = new Date();
      const conversation = await tx.conversation.create({
        data: {
          customerId: input.customerId,
          orderId: input.orderId,
          status: 'open',
          createdAt,
          messages: { create: { role: 'assistant', content: input.greeting, createdAt } },
        },
        select: { id: true },
      });
      await this.audit.record(
        {
          type: 'conversation.started',
          actor: 'customer',
          conversationId: conversation.id,
          data: { orderNumber: input.orderNumber },
          createdAt,
        },
        tx,
      );
      return conversation.id;
    });
    if (conversationId === null) return null;
    return this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: CONVERSATION_DETAIL,
    });
  }
}
