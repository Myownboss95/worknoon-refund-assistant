<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;
use App\Domain\Refunds\Support\Money;

/**
 * R06: totals strictly above humanReviewThresholdCents need human review.
 */
final class R06HumanReviewThreshold implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        $amount = Money::format($ctx->amountCents);
        $threshold = Money::format($ctx->config->humanReviewThresholdCents);

        return $ctx->amountCents > $ctx->config->humanReviewThresholdCents
            ? RuleResult::escalate('R06', "Amount {$amount} is above the {$threshold} review threshold")
            : RuleResult::pass('R06', "Amount {$amount} is within the {$threshold} review threshold");
    }
}
