import { Inject, Injectable } from '@nestjs/common';
import type { ConversationDetail, VerifyResponse } from '@worknoon/contracts';
import { ApiException } from '../common/api-exception.js';
import { firstName } from '../common/formatting.js';
import { ReplyRenderer } from '../common/reply-renderer.js';
import { CONTRACTS } from '../config/tokens.js';
import type { Contracts } from '../config/contracts.loader.js';
import { RefundsRepository } from '../refunds/refunds.repository.js';
import {
  toConversationSummary,
  toCustomerName,
  toDecision,
  toMessage,
  toOrder,
} from './conversation.presenter.js';
import { ConversationsRepository, type ConversationDetailRow } from './conversations.repository.js';

export interface VerifiedOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly customerId: string;
  readonly customerName: string;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversations: ConversationsRepository,
    private readonly refunds: RefundsRepository,
    private readonly renderer: ReplyRenderer,
    @Inject(CONTRACTS) private readonly contracts: Contracts,
  ) {}

  /** Starts a conversation for a verified order and greets the customer. */
  async start(order: VerifiedOrder): Promise<VerifyResponse> {
    const row = await this.conversations.start({
      customerId: order.customerId,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      greeting: this.renderer.greeting(firstName(order.customerName), order.orderNumber),
    });
    const { decision: _decision, ...response } = await this.present(row);
    return response;
  }

  async get(id: string): Promise<ConversationDetail> {
    const row = await this.conversations.findDetail(id);
    if (row === null) throw ApiException.notFound('Conversation not found.');
    return this.present(row);
  }

  private async present(row: ConversationDetailRow): Promise<ConversationDetail> {
    const itemIds = row.order.items.map((item) => item.id);
    const [refundStates, latest] = await Promise.all([
      this.refunds.itemRefundStates(itemIds),
      this.refunds.latestForConversation(row.id),
    ]);
    return {
      conversation: toConversationSummary(row),
      customer: toCustomerName(row.customer.name),
      order: toOrder(row.order, refundStates, this.contracts.policy.currency),
      messages: row.messages.map(toMessage),
      decision: latest === null ? null : toDecision(latest, this.renderer),
    };
  }
}
