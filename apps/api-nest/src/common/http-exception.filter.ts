import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { ErrorCodeSchema, type ErrorCode, type ErrorResponse } from '@worknoon/contracts';
import type { Response } from 'express';
import { ApiException, type ErrorDetail } from './api-exception.js';
import { currentRequestId } from './request-context.js';

interface BodyParserError {
  readonly type: string;
  readonly status: number;
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof error.type === 'string' &&
    error.type.startsWith('entity.') &&
    'status' in error &&
    typeof error.status === 'number'
  );
}

const DEFAULT_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'ADMIN_UNAUTHORIZED',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_FAILED',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'The request is invalid.',
  VERIFICATION_FAILED: "We couldn't find an order matching those details.",
  NOT_FOUND: 'Not found.',
  CONVERSATION_CLOSED: 'This conversation is closed.',
  CONVERSATION_BUSY: "We're still working on your previous message.",
  REFUND_ALREADY_EXISTS: 'A refund request already covers one of these items.',
  REFUND_NOT_REVIEWABLE: 'Only escalated refund requests can be reviewed.',
  ADMIN_UNAUTHORIZED: 'A valid admin token is required.',
  RATE_LIMITED: 'Too many requests. Please try again in a minute.',
  AI_UNAVAILABLE: 'The assistant is temporarily unavailable.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
};

const MALFORMED_BODY: ErrorDetail = {
  field: 'body',
  message: 'The request body is not valid JSON.',
};

interface MappedError {
  readonly status: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
}

/** Renders every error as `{ error: { code, message, details? } }` (docs/pipeline.md, "Errors"). */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = this.map(exception);
    const body: ErrorResponse = {
      error: {
        code: mapped.code,
        message: mapped.message,
        ...(mapped.code === 'VALIDATION_FAILED' ? { details: [...(mapped.details ?? [])] } : {}),
      },
    };
    response.status(mapped.status).json(body);
  }

  private map(exception: unknown): MappedError {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        ...(exception.details ? { details: exception.details } : {}),
      };
    }
    if (isBodyParserError(exception)) {
      const detail =
        exception.type === 'entity.too.large'
          ? { field: 'body', message: 'The request body is too large.' }
          : MALFORMED_BODY;
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: 'VALIDATION_FAILED',
        message: DEFAULT_MESSAGES.VALIDATION_FAILED,
        details: [detail],
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const declared = ErrorCodeSchema.safeParse(exception.errorCode);
      const code = declared.success ? declared.data : DEFAULT_CODES[status];
      if (code === 'VALIDATION_FAILED') {
        // Nest's Express adapter turns body-parser SyntaxErrors (malformed JSON) into a bare 400.
        const detail = status === HttpStatus.BAD_REQUEST ? [MALFORMED_BODY] : [];
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          code,
          message: DEFAULT_MESSAGES[code],
          details: detail,
        };
      }
      if (code) return { status, code, message: DEFAULT_MESSAGES[code] };
      if (status < 500) {
        return { status, code: 'VALIDATION_FAILED', message: DEFAULT_MESSAGES.VALIDATION_FAILED };
      }
    }
    this.logger.error({
      event: 'unhandled_exception',
      requestId: currentRequestId(),
      errorName: exception instanceof Error ? exception.name : typeof exception,
      stack: exception instanceof Error ? exception.stack : undefined,
    });
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: DEFAULT_MESSAGES.INTERNAL_ERROR,
    };
  }
}
