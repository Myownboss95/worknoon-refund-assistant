import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@worknoon/contracts';

export interface ErrorDetail {
  readonly field: string;
  readonly message: string;
}

/**
 * An HTTP error with a machine-readable code from the contract. Uses Nest 12's native `errorCode`
 * option so anything that understands HttpException sees the code as well.
 */
export class ApiException extends HttpException {
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[] | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus,
    details?: readonly ErrorDetail[],
    cause?: unknown,
  ) {
    super(message, status, { errorCode: code, cause });
    this.code = code;
    this.details = details;
  }

  static validation(details: readonly ErrorDetail[]): ApiException {
    return new ApiException(
      'VALIDATION_FAILED',
      'The request is invalid.',
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }

  static notFound(message = 'Not found.'): ApiException {
    return new ApiException('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }

  static conflict(code: ErrorCode, message: string): ApiException {
    return new ApiException(code, message, HttpStatus.CONFLICT);
  }
}
