<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy\Rules;

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;

/**
 * R10: only the approvable reasons can be approved automatically; anything else goes to a human.
 */
final class R10NoAutomaticApprovalPath implements PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult
    {
        if (! $ctx->aiAvailable || $ctx->reasonCategory === null) {
            return RuleResult::escalate('R10', 'Reason is unknown (AI unavailable)');
        }

        return $ctx->config->isApprovable($ctx->reasonCategory)
            ? RuleResult::pass('R10', "Reason {$ctx->reasonCategory->value} can be approved automatically")
            : RuleResult::escalate('R10', "Reason {$ctx->reasonCategory->value} cannot be approved automatically");
    }
}
