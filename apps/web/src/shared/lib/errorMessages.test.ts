import { ApiError } from '@/shared/api/ApiError';
import { errorMessages, getErrorMessage } from './errorMessages';

describe('getErrorMessage', () => {
  it('maps CONVERSATION_BUSY to a friendly message', () => {
    const error = new ApiError({
      status: 409,
      code: 'CONVERSATION_BUSY',
      message: "We're still working on your previous message.",
    });
    expect(getErrorMessage(error)).toBe(
      'Still working on your previous message — give it a moment.',
    );
    expect(errorMessages.CONVERSATION_BUSY).toBe(getErrorMessage(error));
  });

  it('falls back to the generic message for unknown errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe(errorMessages.INTERNAL_ERROR);
  });
});
