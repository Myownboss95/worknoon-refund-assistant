import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type OrderWithCustomer = Prisma.OrderGetPayload<{ include: { customer: true } }>;

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The order with this number, only if it belongs to the customer with this email. */
  findOrderForCustomer(orderNumber: string, email: string): Promise<OrderWithCustomer | null> {
    return this.prisma.order.findFirst({
      where: { orderNumber, customer: { email } },
      include: { customer: true },
    });
  }
}
