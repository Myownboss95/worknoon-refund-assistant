<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;
use App\Enums\ReasonCategory;

/**
 * R09: change of mind is approvable within changeOfMindWindowDays of delivery and denied after.
 */
final class R09ChangeOfMind implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        if ($ctx->reasonCategory !== ReasonCategory::ChangedMind) {
            return RuleResult::notApplicable('R09', 'Reason is not change of mind');
        }

        if (! $ctx->isDelivered()) {
            return RuleResult::notApplicable('R09', 'Order has not been delivered');
        }

        $window = $ctx->config->changeOfMindWindowDays;

        return $ctx->daysSinceDelivery > $window
            ? RuleResult::deny('R09', "Change of mind {$ctx->daysSinceDelivery} days after delivery; window is {$window} days")
            : RuleResult::approve('R09', "Change of mind {$ctx->daysSinceDelivery} days after delivery; within the {$window}-day window");
    }
}
