<?php

declare(strict_types=1);

namespace App\Data;

/**
 * The result of one successful model call: an extraction (extract step) or reply text (compose step).
 */
final readonly class AnalyzerResult
{
    public function __construct(
        public ?Extraction $extraction = null,
        public ?string $text = null,
        public int $inputTokens = 0,
        public int $outputTokens = 0,
    ) {}

    public static function extracted(Extraction $extraction, int $inputTokens = 0, int $outputTokens = 0): self
    {
        return new self(extraction: $extraction, inputTokens: $inputTokens, outputTokens: $outputTokens);
    }

    public static function composed(string $text, int $inputTokens = 0, int $outputTokens = 0): self
    {
        return new self(text: $text, inputTokens: $inputTokens, outputTokens: $outputTokens);
    }
}
