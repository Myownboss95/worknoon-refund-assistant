import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { ConversationDetail, SendMessageResponse } from '@worknoon/contracts';
import { IdParamSchema } from '../common/id-param.js';
import { RefundPipelineService } from '../refunds/refund-pipeline.service.js';
import { ConversationsService } from './conversations.service.js';

@Controller({ path: 'conversations', version: '1' })
export class ConversationsController {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly pipeline: RefundPipelineService,
  ) {}

  @Get(':id')
  get(@Param('id', { schema: IdParamSchema }) id: string): Promise<ConversationDetail> {
    return this.conversations.get(id);
  }

  /**
   * The body is validated by the pipeline rather than a `{ schema }` pipe: docs/pipeline.md loads
   * the conversation first (404 / 409) and validates second (422), and pipes always run first.
   */
  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ verify: true })
  sendMessage(
    @Param('id', { schema: IdParamSchema }) id: string,
    @Body() body: unknown,
  ): Promise<SendMessageResponse> {
    return this.pipeline.handleMessage(id, body);
  }
}
