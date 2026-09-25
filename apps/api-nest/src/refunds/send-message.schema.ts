import { SendMessageRequestSchema } from '@worknoon/contracts';
import { z } from 'zod';
import { sanitizeMessageText } from '../common/text.js';
import type { FullPolicyConfig } from '../config/contracts.schema.js';

/**
 * The contract's SendMessageRequest with the limits taken from policy.config.json, and `text`
 * sanitised before its length is checked: control characters (except newline and tab) are
 * stripped and the result trimmed (pipeline step 2).
 */
export function createSendMessageBodySchema(
  policy: Pick<FullPolicyConfig, 'maxMessageLength' | 'maxItemsPerRequest'>,
) {
  return SendMessageRequestSchema.extend({
    text: z
      .string()
      .transform(sanitizeMessageText)
      .pipe(z.string().min(1, 'Message cannot be empty').max(policy.maxMessageLength)),
    itemIds: z
      .array(z.uuid())
      .min(1)
      .max(policy.maxItemsPerRequest)
      .refine((ids) => new Set(ids).size === ids.length, { message: 'Item ids must be unique' }),
  });
}

export type SendMessageBody = z.infer<ReturnType<typeof createSendMessageBodySchema>>;
