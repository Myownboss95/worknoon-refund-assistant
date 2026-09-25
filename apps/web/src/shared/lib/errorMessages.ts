import { ApiError, type ClientErrorCode } from '@/shared/api/ApiError';

export const errorMessages: Record<ClientErrorCode, string> = {
  VALIDATION_FAILED: 'Some details look off. Please check the highlighted fields and try again.',
  VERIFICATION_FAILED:
    "We couldn't find an order matching those details. Check the email and order number and try again.",
  NOT_FOUND: "We couldn't find what you were looking for. It may have been removed or reset.",
  CONVERSATION_CLOSED:
    'This conversation has already been resolved. Start over to make a new request.',
  REFUND_ALREADY_EXISTS:
    'A refund for one of these items has already been issued or is being reviewed.',
  REFUND_NOT_REVIEWABLE: 'This request has already been reviewed, so it can no longer be changed.',
  ADMIN_UNAUTHORIZED: 'That admin token was not accepted. Please enter a valid token.',
  RATE_LIMITED: "You're going a little fast. Please wait a moment and try again.",
  AI_UNAVAILABLE: 'Our assistant is temporarily unavailable. Please try again shortly.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  NETWORK_ERROR: "We couldn't reach the server. Check that the backend is running and try again.",
  INVALID_RESPONSE: 'The server sent an unexpected response. Please try again or switch backend.',
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return errorMessages[error.code];
  return errorMessages.INTERNAL_ERROR;
}
