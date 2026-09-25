import { ExtractionSchema, type Extraction } from '@worknoon/contracts';
import type { ExtractionOutput } from '../ai/extraction-output.schema.js';

const SUMMARY_MAX_LENGTH = 280;

/** Clamps confidence to [0, 1] and truncates the summary to 280 characters (pipeline step 5). */
export function normalizeExtraction(output: ExtractionOutput): Extraction {
  const confidence = Number.isFinite(output.confidence)
    ? Math.min(1, Math.max(0, output.confidence))
    : 0;
  const summary = Array.from(output.summary).slice(0, SUMMARY_MAX_LENGTH).join('');
  return ExtractionSchema.parse({ ...output, confidence, summary });
}
