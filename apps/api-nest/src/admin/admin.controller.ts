import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  RefundListQuerySchema,
  ReviewRequestSchema,
  type RefundListQuery,
  type RefundRequestDetail,
  type RefundRequestList,
  type ResetResponse,
  type ReviewRequest,
  type Stats,
} from '@worknoon/contracts';
import { AdminTokenGuard } from '../common/admin-token.guard.js';
import { IdParamSchema } from '../common/id-param.js';
import { AdminService } from './admin.service.js';

@Controller({ path: 'admin', version: '1' })
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('refund-requests')
  list(
    @Query({ schema: RefundListQuerySchema }) query: RefundListQuery,
  ): Promise<RefundRequestList> {
    return this.admin.list(query);
  }

  @Get('refund-requests/:id')
  detail(@Param('id', { schema: IdParamSchema }) id: string): Promise<RefundRequestDetail> {
    return this.admin.detail(id);
  }

  @Post('refund-requests/:id/review')
  @HttpCode(HttpStatus.OK)
  review(
    @Param('id', { schema: IdParamSchema }) id: string,
    @Body({ schema: ReviewRequestSchema }) body: ReviewRequest,
  ): Promise<RefundRequestDetail> {
    return this.admin.review(id, body);
  }

  @Get('stats')
  stats(): Promise<Stats> {
    return this.admin.stats();
  }

  @Post('demo/reset')
  @HttpCode(HttpStatus.OK)
  reset(): Promise<ResetResponse> {
    return this.admin.reset();
  }
}
