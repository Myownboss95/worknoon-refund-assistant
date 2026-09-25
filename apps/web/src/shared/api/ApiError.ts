import type { ErrorCode } from '@worknoon/contracts';

/** Server error codes plus the ones the client produces itself. */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly details: ApiErrorDetail[];

  constructor(init: {
    status: number;
    code: ClientErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
  }

  /** The first validation message for a field, if the server sent one. */
  fieldError(field: string): string | undefined {
    return this.details.find((detail) => detail.field === field)?.message;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
