import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import type { Db } from '../prisma/database.types.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const AUDIT_EVENT_TYPES = [
  'verification.failed',
  'conversation.started',
  'conversation.clarification_requested',
  'refund.decided',
  'refund.reviewed',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];
export type AuditActor = 'system' | 'admin' | 'customer';

export interface AuditEventInput {
  readonly type: AuditEventType;
  readonly actor: AuditActor;
  readonly conversationId?: string | null;
  readonly refundRequestId?: string | null;
  readonly data: Prisma.InputJsonObject;
  readonly createdAt?: Date;
}

/** Append-only audit trail. Callers must never put unmasked emails or message text in `data`. */
@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEventInput, db: Db = this.prisma): Promise<void> {
    await db.auditEvent.create({
      data: {
        type: event.type,
        actor: event.actor,
        conversationId: event.conversationId ?? null,
        refundRequestId: event.refundRequestId ?? null,
        data: event.data,
        ...(event.createdAt ? { createdAt: event.createdAt } : {}),
      },
    });
  }
}
