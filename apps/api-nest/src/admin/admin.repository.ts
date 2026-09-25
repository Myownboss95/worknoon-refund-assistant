import { Injectable } from '@nestjs/common';
import type { RefundListQuery, RefundStatus, ReviewDecision } from '@worknoon/contracts';
import { AuditRepository } from '../audit/audit.repository.js';
import type { AuditEvent, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Admin views only include requests created by the assistant; imported history is excluded. */
const ASSISTANT_CREATED = {
  conversationId: { not: null },
} satisfies Prisma.RefundRequestWhereInput;

const SUMMARY_INCLUDE = {
  customer: { select: { name: true, email: true } },
  order: { select: { orderNumber: true } },
} satisfies Prisma.RefundRequestInclude;

const DETAIL_INCLUDE = {
  ...SUMMARY_INCLUDE,
  items: {
    include: { orderItem: true },
    orderBy: [{ orderItem: { sku: 'asc' } }, { orderItem: { id: 'asc' } }],
  },
  conversation: { include: { messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } },
} satisfies Prisma.RefundRequestInclude;

export type RefundRequestSummaryRow = Prisma.RefundRequestGetPayload<{
  include: typeof SUMMARY_INCLUDE;
}>;
export type RefundRequestDetailRow = Prisma.RefundRequestGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

export interface ReviewInput {
  readonly id: string;
  readonly conversationId: string;
  readonly decision: ReviewDecision;
  readonly note: string;
  readonly reviewer: string;
  readonly systemMessage: string;
}

export interface RefundStats {
  readonly total: number;
  readonly byStatus: Record<RefundStatus, number>;
  readonly escalatedTotal: number;
  readonly humanReviewed: number;
  readonly autoResolved: number;
}

@Injectable()
export class AdminRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditRepository,
  ) {}

  async list({ status, page, perPage }: RefundListQuery): Promise<{
    rows: RefundRequestSummaryRow[];
    total: number;
  }> {
    const where: Prisma.RefundRequestWhereInput = {
      ...ASSISTANT_CREATED,
      ...(status ? { status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.refundRequest.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      this.prisma.refundRequest.count({ where }),
    ]);
    return { rows, total };
  }

  findDetail(id: string): Promise<RefundRequestDetailRow | null> {
    return this.prisma.refundRequest.findFirst({
      where: { id, ...ASSISTANT_CREATED },
      include: DETAIL_INCLUDE,
    });
  }

  /** Events for the request and its conversation, oldest first. */
  auditEventsFor(refundRequestId: string, conversationId: string): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: { OR: [{ refundRequestId }, { conversationId }] },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Applies a human decision to an escalated request, appends the system message and records the
   * audit event in one transaction. Returns false if the request was no longer escalated.
   */
  async review(input: ReviewInput): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const reviewedAt = new Date();
      const { count } = await tx.refundRequest.updateMany({
        where: { id: input.id, status: 'escalated' },
        data: {
          status: input.decision === 'approve' ? 'approved' : 'denied',
          decidedBy: 'human',
          reviewDecision: input.decision,
          reviewNote: input.note,
          reviewedBy: input.reviewer,
          reviewedAt,
        },
      });
      if (count === 0) return false;
      await tx.message.create({
        data: {
          conversationId: input.conversationId,
          role: 'system',
          content: input.systemMessage,
          createdAt: reviewedAt,
        },
      });
      await this.audit.record(
        {
          type: 'refund.reviewed',
          actor: 'admin',
          conversationId: input.conversationId,
          refundRequestId: input.id,
          data: { decision: input.decision, note: input.note },
          createdAt: reviewedAt,
        },
        tx,
      );
      return true;
    });
  }

  async stats(): Promise<RefundStats> {
    const refundRequest = this.prisma.refundRequest;
    const [grouped, escalatedTotal, humanReviewed, autoResolved] = await this.prisma.$transaction([
      refundRequest.groupBy({
        by: ['status'],
        where: ASSISTANT_CREATED,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      refundRequest.count({
        where: { ...ASSISTANT_CREATED, OR: [{ status: 'escalated' }, { decidedBy: 'human' }] },
      }),
      refundRequest.count({ where: { ...ASSISTANT_CREATED, decidedBy: 'human' } }),
      refundRequest.count({
        where: {
          ...ASSISTANT_CREATED,
          decidedBy: 'policy',
          status: { in: ['approved', 'denied'] },
        },
      }),
    ]);
    const byStatus: Record<RefundStatus, number> = { approved: 0, denied: 0, escalated: 0 };
    for (const group of grouped) {
      const count = group._count;
      byStatus[group.status] = typeof count === 'object' ? (count._all ?? 0) : 0;
    }
    const total = byStatus.approved + byStatus.denied + byStatus.escalated;
    return { total, byStatus, escalatedTotal, humanReviewed, autoResolved };
  }
}
