<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy;

use App\Domain\Refunds\Policy\Rules\R01OrderOwnership;
use App\Domain\Refunds\Policy\Rules\R02OrderDelivered;
use App\Domain\Refunds\Policy\Rules\R03RefundWindow;
use App\Domain\Refunds\Policy\Rules\R04FinalSale;
use App\Domain\Refunds\Policy\Rules\R05RefundOncePerItem;
use App\Domain\Refunds\Policy\Rules\R06HumanReviewThreshold;
use App\Domain\Refunds\Policy\Rules\R07SuspiciousSignals;
use App\Domain\Refunds\Policy\Rules\R08MerchantFault;
use App\Domain\Refunds\Policy\Rules\R09ChangeOfMind;
use App\Domain\Refunds\Policy\Rules\R10NoAutomaticApprovalPath;
use App\Enums\Flag;
use App\Enums\RefundStatus;
use App\Enums\RuleOutcome;

/**
 * Evaluates every rule, in order, and combines the outcomes with the precedence
 * deny > escalate > approve > fallback escalate (policy/refund-policy.md).
 */
final readonly class PolicyEngine
{
    /**
     * @param  list<PolicyRule>  $rules
     */
    public function __construct(private array $rules) {}

    public static function default(): self
    {
        return new self([
            new R01OrderOwnership,
            new R02OrderDelivered,
            new R03RefundWindow,
            new R04FinalSale,
            new R05RefundOncePerItem,
            new R06HumanReviewThreshold,
            new R07SuspiciousSignals,
            new R08MerchantFault,
            new R09ChangeOfMind,
            new R10NoAutomaticApprovalPath,
        ]);
    }

    public function evaluate(PolicyContext $ctx): PolicyDecision
    {
        $results = array_map(
            static fn (PolicyRule $rule): RuleResult => $rule->evaluate($ctx),
            $this->rules,
        );

        $status = $this->combine($results);
        $decisiveOutcome = RuleOutcome::producing($status);

        $decisiveRuleIds = array_values(array_map(
            static fn (RuleResult $result): string => $result->ruleId,
            array_filter($results, static fn (RuleResult $result): bool => $result->outcome === $decisiveOutcome),
        ));

        $flags = array_map(
            static fn (string $value): Flag => Flag::from($value),
            Flag::normalize(array_merge(...array_map(
                static fn (RuleResult $result): array => $result->flags,
                $results,
            ))),
        );

        return new PolicyDecision($status, $decisiveRuleIds, $results, $flags);
    }

    /**
     * @param  list<RuleResult>  $results
     */
    private function combine(array $results): RefundStatus
    {
        $outcomes = array_map(static fn (RuleResult $result): RuleOutcome => $result->outcome, $results);

        return match (true) {
            in_array(RuleOutcome::Deny, $outcomes, true) => RefundStatus::Denied,
            in_array(RuleOutcome::Escalate, $outcomes, true) => RefundStatus::Escalated,
            in_array(RuleOutcome::Approve, $outcomes, true) => RefundStatus::Approved,
            // Fail safe: nothing supported approval, so a human decides.
            default => RefundStatus::Escalated,
        };
    }
}
