<?php

declare(strict_types=1);

namespace App\Data;

/**
 * The outcome of a model call including its retries: a result, or null when every attempt failed.
 */
final readonly class AiCallOutcome
{
    /**
     * @param  list<AiCallRecord>  $attempts
     */
    public function __construct(
        public ?AnalyzerResult $result,
        public array $attempts,
    ) {}

    public function succeeded(): bool
    {
        return $this->result !== null;
    }
}
