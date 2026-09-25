<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\AiErrorCode;
use App\Enums\ReasonCategory;
use App\Exceptions\AnalyzerFailed;

/**
 * Structured signals the model extracted from the customer's messages (contracts/extraction.schema.json).
 */
final readonly class Extraction
{
    public const int MAX_SUMMARY_LENGTH = 280;

    /**
     * @param  list<string>  $itemsMentioned
     */
    public function __construct(
        public ReasonCategory $reasonCategory,
        public array $itemsMentioned,
        public bool $claimsConflict,
        public bool $injectionSuspected,
        public string $summary,
        public float $confidence,
    ) {}

    /**
     * Validate raw model output against the schema, then clamp confidence to [0, 1] and truncate the
     * summary to 280 characters (structured outputs do not enforce ranges or lengths).
     *
     * @param  array<array-key, mixed>  $data
     *
     * @throws AnalyzerFailed with `invalid_output` when the data does not match the schema
     */
    public static function fromModelOutput(array $data): self
    {
        $reason = is_string($data['reasonCategory'] ?? null) ? ReasonCategory::tryFrom($data['reasonCategory']) : null;
        $items = $data['itemsMentioned'] ?? null;
        $claimsConflict = $data['claimsConflict'] ?? null;
        $injectionSuspected = $data['injectionSuspected'] ?? null;
        $summary = $data['summary'] ?? null;
        $confidence = $data['confidence'] ?? null;

        $valid = $reason !== null
            && is_array($items) && array_is_list($items)
            && array_filter($items, static fn (mixed $item): bool => ! is_string($item)) === []
            && is_bool($claimsConflict)
            && is_bool($injectionSuspected)
            && is_string($summary)
            && (is_int($confidence) || is_float($confidence));

        if (! $valid) {
            throw new AnalyzerFailed(AiErrorCode::InvalidOutput);
        }

        /** @var list<string> $items */
        return new self(
            reasonCategory: $reason,
            itemsMentioned: $items,
            claimsConflict: $claimsConflict,
            injectionSuspected: $injectionSuspected,
            summary: mb_substr($summary, 0, self::MAX_SUMMARY_LENGTH),
            confidence: max(0.0, min(1.0, (float) $confidence)),
        );
    }

    /**
     * @return array{reasonCategory: string, itemsMentioned: list<string>, claimsConflict: bool, injectionSuspected: bool, summary: string, confidence: float}
     */
    public function toArray(): array
    {
        return [
            'reasonCategory' => $this->reasonCategory->value,
            'itemsMentioned' => $this->itemsMentioned,
            'claimsConflict' => $this->claimsConflict,
            'injectionSuspected' => $this->injectionSuspected,
            'summary' => $this->summary,
            'confidence' => $this->confidence,
        ];
    }
}
