import { ReasonCategorySchema } from '@worknoon/contracts';
import { z } from 'zod';

/**
 * The shape sent to the model as its structured output format (mirrors contracts/extraction.schema.json).
 * Structured outputs cannot enforce string length or number ranges, so this deliberately has no
 * min/max constraints; the pipeline clamps confidence and truncates the summary after parsing.
 */
export const ExtractionOutputSchema = z.object({
  reasonCategory: ReasonCategorySchema,
  itemsMentioned: z.array(z.string()),
  claimsConflict: z.boolean(),
  injectionSuspected: z.boolean(),
  summary: z.string(),
  confidence: z.number(),
});

export type ExtractionOutput = z.infer<typeof ExtractionOutputSchema>;
