<?php

declare(strict_types=1);

namespace App\Ai;

use App\Ai\Contracts\RefundAnalyzer;
use App\Data\AiCallOutcome;
use App\Data\AiCallRecord;
use App\Data\AnalyzerResult;
use App\Enums\AiErrorCode;
use App\Enums\AiStep;
use App\Exceptions\AnalyzerFailed;
use Closure;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Runs one model call with the pipeline's retry policy (one retry), records every attempt for the
 * decision trace, and writes one structured log line per attempt. Never logs prompts or message text.
 */
final readonly class AiCallRunner
{
    public function __construct(
        private RefundAnalyzer $analyzer,
        private LoggerInterface $logger,
        private int $maxAttempts = 2,
    ) {}

    /**
     * @param  Closure(): AnalyzerResult  $call
     */
    public function run(AiStep $step, string $promptVersion, Closure $call): AiCallOutcome
    {
        $attempts = [];

        for ($attempt = 1; $attempt <= $this->maxAttempts; $attempt++) {
            $startedAt = hrtime(true);
            $result = null;
            $error = null;

            try {
                $result = $call();
            } catch (AnalyzerFailed $exception) {
                $error = $exception->errorCode;
            } catch (Throwable $exception) {
                // An unexpected failure must not break the pipeline; it fails safe to a human.
                report($exception);
                $error = AiErrorCode::ProviderError;
            }

            $record = new AiCallRecord(
                step: $step,
                attempt: $attempt,
                ok: $result !== null,
                latencyMs: (int) round((hrtime(true) - $startedAt) / 1_000_000),
                inputTokens: $result->inputTokens ?? 0,
                outputTokens: $result->outputTokens ?? 0,
                error: $error,
            );

            $attempts[] = $record;
            $this->log($record, $promptVersion);

            if ($result !== null) {
                return new AiCallOutcome($result, $attempts);
            }
        }

        return new AiCallOutcome(null, $attempts);
    }

    private function log(AiCallRecord $record, string $promptVersion): void
    {
        $this->logger->info('ai.call', [
            'step' => $record->step->value,
            'provider' => $this->analyzer->provider(),
            'model' => $this->analyzer->model(),
            'promptVersion' => $promptVersion,
            'attempt' => $record->attempt,
            'latencyMs' => $record->latencyMs,
            'inputTokens' => $record->inputTokens,
            'outputTokens' => $record->outputTokens,
            'ok' => $record->ok,
            'error' => $record->error?->value,
        ]);
    }
}
