<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;

/**
 * R02: the order must be delivered. Processing or shipped orders are directed to cancellation.
 */
final class R02OrderDelivered implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        return $ctx->isDelivered()
            ? RuleResult::pass('R02', 'Order has been delivered')
            : RuleResult::deny('R02', "Order is {$ctx->orderStatus->value}, not delivered");
    }
}
