import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { VerifyResponse } from '@worknoon/contracts';
import { CustomersService } from './customers.service.js';
import { VerifyBodySchema, type VerifyBody } from './verify.schema.js';

@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post('verify')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ messages: true })
  verify(@Body({ schema: VerifyBodySchema }) body: VerifyBody): Promise<VerifyResponse> {
    return this.customers.verify(body);
  }
}
