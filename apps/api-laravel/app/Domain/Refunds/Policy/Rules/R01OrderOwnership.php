<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;

/**
 * R01: the order must belong to the verified customer.
 */
final class R01OrderOwnership implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        return $ctx->orderCustomerId === $ctx->verifiedCustomerId
            ? RuleResult::pass('R01', 'Order belongs to the verified customer')
            : RuleResult::deny('R01', 'Order does not belong to the verified customer');
    }
}
