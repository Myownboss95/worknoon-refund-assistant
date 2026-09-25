import { Injectable } from '@nestjs/common';
import type {
  RefundListQuery,
  RefundRequestDetail,
  RefundRequestList,
  ResetResponse,
  ReviewRequest,
  Stats,
} from '@worknoon/contracts';
import { ApiException } from '../common/api-exception.js';
import { ReplyRenderer } from '../common/reply-renderer.js';
import { AppConfig } from '../config/app-config.js';
import { AdminRepository } from './admin.repository.js';
import { DemoDataRepository } from './demo-data.repository.js';
import { toRefundRequestDetail, toRefundRequestSummary } from './refund-request.presenter.js';

export const REVIEWER = 'admin';

const rate = (count: number, total: number): number =>
  total === 0 ? 0 : Math.round((count / total) * 10_000) / 10_000;

@Injectable()
export class AdminService {
  constructor(
    private readonly admin: AdminRepository,
    private readonly demoData: DemoDataRepository,
    private readonly renderer: ReplyRenderer,
    private readonly config: AppConfig,
  ) {}

  async list(query: RefundListQuery): Promise<RefundRequestList> {
    const { rows, total } = await this.admin.list(query);
    return {
      data: rows.map(toRefundRequestSummary),
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        lastPage: Math.max(1, Math.ceil(total / query.perPage)),
      },
    };
  }

  async detail(id: string): Promise<RefundRequestDetail> {
    const row = await this.admin.findDetail(id);
    if (row === null || row.conversation === null)
      throw ApiException.notFound('Refund request not found.');
    const auditEvents = await this.admin.auditEventsFor(row.id, row.conversation.id);
    return toRefundRequestDetail({ ...row, conversation: row.conversation }, auditEvents);
  }

  /** Human decision on an escalated request (docs/pipeline.md, "Human review"). */
  async review(id: string, { decision, note }: ReviewRequest): Promise<RefundRequestDetail> {
    const row = await this.admin.findDetail(id);
    if (row === null || row.conversation === null)
      throw ApiException.notFound('Refund request not found.');
    const reviewed =
      row.status === 'escalated' &&
      (await this.admin.review({
        id: row.id,
        conversationId: row.conversation.id,
        decision,
        note,
        reviewer: REVIEWER,
        systemMessage: this.renderer.humanReview(decision, row.amountCents, note),
      }));
    if (!reviewed) {
      throw ApiException.conflict(
        'REFUND_NOT_REVIEWABLE',
        'Only escalated refund requests can be reviewed.',
      );
    }
    return this.detail(id);
  }

  async stats(): Promise<Stats> {
    const stats = await this.admin.stats();
    return {
      total: stats.total,
      byStatus: stats.byStatus,
      escalatedTotal: stats.escalatedTotal,
      humanReviewed: stats.humanReviewed,
      escalationRate: rate(stats.escalatedTotal, stats.total),
      autoResolutionRate: rate(stats.autoResolved, stats.total),
    };
  }

  /** Only in DEMO_MODE; otherwise the route does not exist (checked after the admin token). */
  async reset(): Promise<ResetResponse> {
    if (!this.config.demoMode) throw ApiException.notFound();
    const summary = await this.demoData.reset();
    return { reset: true, customers: summary.customers, orders: summary.orders };
  }
}
