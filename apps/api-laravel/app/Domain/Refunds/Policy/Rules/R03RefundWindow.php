<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;

/**
 * R03: refunds are available for refundWindowDays whole days after delivery.
 */
final class R03RefundWindow implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        if (! $ctx->isDelivered()) {
            return RuleResult::notApplicable('R03', 'Order has not been delivered');
        }

        $window = $ctx->config->refundWindowDays;

        return $ctx->daysSinceDelivery > $window
            ? RuleResult::deny('R03', "Delivered {$ctx->daysSinceDelivery} days ago; window is {$window} days")
            : RuleResult::pass('R03', "Delivered {$ctx->daysSinceDelivery} days ago; within the {$window}-day window");
    }
}
