import { VerifyRequestSchema } from '@worknoon/contracts';
import { z } from 'zod';

const trimmed = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value);

/**
 * The contract's VerifyRequest, validated after trimming, then normalised: email lowercased, order
 * number uppercased (pipeline step 1).
 */
export const VerifyBodySchema = z
  .object({
    email: z.preprocess(trimmed, VerifyRequestSchema.shape.email),
    orderNumber: z.preprocess(trimmed, VerifyRequestSchema.shape.orderNumber),
  })
  .transform(({ email, orderNumber }) => ({
    email: email.toLowerCase(),
    orderNumber: orderNumber.toUpperCase(),
  }));

export type VerifyBody = z.infer<typeof VerifyBodySchema>;
