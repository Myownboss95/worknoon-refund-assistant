<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;

/**
 * R04: final sale items are not refundable, unless the reason is a merchant fault (or unknown because
 * the AI was unavailable), in which case a human decides.
 */
final class R04FinalSale implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        if ($ctx->finalSaleItemIds === []) {
            return RuleResult::pass('R04', 'No selected item is final sale');
        }

        if (! $ctx->aiAvailable) {
            return RuleResult::escalate('R04', 'Final sale item selected and the reason is unknown (AI unavailable)');
        }

        if ($ctx->config->isMerchantFault($ctx->reasonCategory)) {
            return RuleResult::escalate('R04', "Final sale item reported as {$ctx->reasonCategory?->value}; merchant fault needs review");
        }

        return RuleResult::deny('R04', 'A selected item is final sale');
    }
}
