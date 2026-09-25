<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\AiErrorCode;
use App\Enums\AiStep;

/**
 * One attempt at one model call, as recorded in `trace.ai.calls`.
 */
final readonly class AiCallRecord
{
    public function __construct(
        public AiStep $step,
        public int $attempt,
        public bool $ok,
        public int $latencyMs,
        public int $inputTokens,
        public int $outputTokens,
        public ?AiErrorCode $error,
    ) {}

    /**
     * @return array{step: string, attempt: int, ok: bool, latencyMs: int, inputTokens: int, outputTokens: int, error: string|null}
     */
    public function toArray(): array
    {
        return [
            'step' => $this->step->value,
            'attempt' => $this->attempt,
            'ok' => $this->ok,
            'latencyMs' => $this->latencyMs,
            'inputTokens' => $this->inputTokens,
            'outputTokens' => $this->outputTokens,
            'error' => $this->error?->value,
        ];
    }
}
