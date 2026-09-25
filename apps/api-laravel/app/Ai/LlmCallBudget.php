<?php

declare(strict_types=1);

namespace App\Ai;

use Illuminate\Cache\RateLimiter;
use Psr\Log\LoggerInterface;

/**
 * Global budget of real provider calls per hour (LLM_MAX_CALLS_PER_HOUR). Every extract and compose
 * attempt takes one call from it; the counter lives in the rate limiter's cache store and is
 * incremented atomically, so it holds across workers. Not applied to the mock analyzer.
 */
final readonly class LlmCallBudget
{
    private const string KEY = 'llm-budget';

    private const string WARNING_KEY = 'llm-budget-warning';

    private const int WINDOW_SECONDS = 3600;

    public function __construct(
        private RateLimiter $limiter,
        private LoggerInterface $logger,
        private int $maxCallsPerHour,
    ) {}

    /**
     * Take one call from the budget. False when the budget for the current hour is spent.
     */
    public function take(): bool
    {
        if ($this->limiter->increment(self::KEY, self::WINDOW_SECONDS) <= $this->maxCallsPerHour) {
            return true;
        }

        // One warning per hour, however many calls are refused.
        if ($this->limiter->increment(self::WARNING_KEY, self::WINDOW_SECONDS) === 1) {
            $this->logger->warning('ai.budget_exhausted', ['maxCallsPerHour' => $this->maxCallsPerHour]);
        }

        return false;
    }
}
