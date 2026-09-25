<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy;

use App\Enums\Flag;
use App\Enums\RefundStatus;

final readonly class PolicyDecision
{
    /**
     * @param  list<string>  $decisiveRuleIds  rules whose outcome matches the decision, in rule order
     * @param  list<RuleResult>  $results  every rule, in evaluation order
     * @param  list<Flag>  $flags  flags raised by the rules (R07), unique and sorted
     */
    public function __construct(
        public RefundStatus $status,
        public array $decisiveRuleIds,
        public array $results,
        public array $flags,
    ) {}
}
