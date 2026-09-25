import { HttpStatus, Injectable } from '@nestjs/common';
import type { VerifyResponse } from '@worknoon/contracts';
import { AuditRepository } from '../audit/audit.repository.js';
import { ApiException } from '../common/api-exception.js';
import { maskEmail } from '../common/formatting.js';
import { ConversationsService } from '../conversations/conversations.service.js';
import { CustomersRepository } from './customers.repository.js';
import type { VerifyBody } from './verify.schema.js';

export const VERIFICATION_FAILED_MESSAGE = "We couldn't find an order matching those details.";

@Injectable()
export class CustomersService {
  constructor(
    private readonly customers: CustomersRepository,
    private readonly conversations: ConversationsService,
    private readonly audit: AuditRepository,
  ) {}

  /**
   * Matches the order to the email and starts a conversation. Every failure gets the same generic
   * answer so the endpoint never reveals whether the email or the order number was wrong.
   */
  async verify({ email, orderNumber }: VerifyBody): Promise<VerifyResponse> {
    const order = await this.customers.findOrderForCustomer(orderNumber, email);
    if (order === null) {
      await this.audit.record({
        type: 'verification.failed',
        actor: 'customer',
        data: { email: maskEmail(email), orderNumber },
      });
      throw new ApiException(
        'VERIFICATION_FAILED',
        VERIFICATION_FAILED_MESSAGE,
        HttpStatus.NOT_FOUND,
      );
    }
    return this.conversations.start({
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customer.id,
      customerName: order.customer.name,
    });
  }
}
