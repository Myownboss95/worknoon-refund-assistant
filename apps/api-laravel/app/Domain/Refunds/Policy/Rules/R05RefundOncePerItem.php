<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;

/**
 * R05: an item can only be refunded once (an approved or pending request blocks it).
 */
final class R05RefundOncePerItem implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        $count = count($ctx->alreadyRefundedItemIds);

        return $count === 0
            ? RuleResult::pass('R05', 'No selected item has an approved or pending refund')
            : RuleResult::deny('R05', "{$count} selected item(s) already have an approved or pending refund");
    }
}
