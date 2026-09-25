<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;

/**
 * R08: damaged, defective or wrong items delivered within the refund window can be approved.
 */
final class R08MerchantFault implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        if (! $ctx->config->isMerchantFault($ctx->reasonCategory)) {
            return RuleResult::notApplicable('R08', 'Reason is not damaged, defective or wrong item');
        }

        if (! $ctx->isDelivered()) {
            return RuleResult::notApplicable('R08', 'Order has not been delivered');
        }

        if (! $ctx->withinRefundWindow()) {
            return RuleResult::notApplicable('R08', 'Delivered outside the refund window');
        }

        return RuleResult::approve('R08', "Reported {$ctx->reasonCategory?->value} within the refund window");
    }
}
