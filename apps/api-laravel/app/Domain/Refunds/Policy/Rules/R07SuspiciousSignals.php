<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;
use App\Enums\Flag;
use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;

/**
 * R07: suspicious signals need human review. Records which signals fired as flags.
 */
final class R07SuspiciousSignals implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        $flags = $this->flags($ctx);

        if ($flags === []) {
            return RuleResult::pass('R07', 'No suspicious signals');
        }

        $names = implode(', ', array_map(static fn (Flag $flag): string => $flag->value, $flags));

        return RuleResult::escalate('R07', "Suspicious signals: {$names}", $flags);
    }

    /**
     * @return list<Flag>
     */
    private function flags(PolicyContext $ctx): array
    {
        $config = $ctx->config;
        $flags = [];

        if ($ctx->recentApprovedRefunds >= $config->suspiciousRefundCount) {
            $flags[] = Flag::HighRefundFrequency;
        }

        if ($ctx->heuristicMatches !== []) {
            $flags[] = Flag::InjectionHeuristic;
        }

        if (! $ctx->aiAvailable) {
            $flags[] = Flag::AiUnavailable;

            return $flags;
        }

        $notReceivedButDelivered = $ctx->reasonCategory === ReasonCategory::NotReceived
            && $ctx->orderStatus === OrderStatus::Delivered;

        if ($ctx->claimsConflict || $notReceivedButDelivered) {
            $flags[] = Flag::ClaimConflict;
        }

        if ($ctx->injectionSuspected) {
            $flags[] = Flag::InjectionModel;
        }

        $lowConfidence = $ctx->confidence !== null && $ctx->confidence < $config->minAiConfidence;
        $stillUnclear = $ctx->reasonCategory === ReasonCategory::Unclear && $ctx->clarificationExhausted;

        if ($lowConfidence || $stillUnclear) {
            $flags[] = Flag::LowConfidence;
        }

        return $flags;
    }
}
