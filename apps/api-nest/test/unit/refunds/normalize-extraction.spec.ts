import { describe, expect, it } from 'vitest';
import type { ExtractionOutput } from '../../../src/ai/extraction-output.schema.js';
import { normalizeExtraction } from '../../../src/refunds/normalize-extraction.js';

const output = (overrides: Partial<ExtractionOutput>): ExtractionOutput => ({
  reasonCategory: 'damaged',
  itemsMentioned: [],
  claimsConflict: false,
  injectionSuspected: false,
  summary: 'Arrived cracked.',
  confidence: 0.9,
  ...overrides,
});

describe('normalizeExtraction', () => {
  it.each([
    [1.7, 1],
    [-0.2, 0],
    [0.42, 0.42],
    [Number.NaN, 0],
  ])('clamps confidence %d to %d', (confidence, expected) => {
    expect(normalizeExtraction(output({ confidence })).confidence).toBe(expected);
  });

  it('truncates the summary to 280 characters', () => {
    expect(normalizeExtraction(output({ summary: 'x'.repeat(400) })).summary).toHaveLength(280);
  });
});
