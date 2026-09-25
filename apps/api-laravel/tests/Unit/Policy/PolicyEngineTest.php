<?php

declare(strict_types=1);

use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyEngine;
use App\Domain\Refunds\Policy\PolicyRule;
use App\Domain\Refunds\Policy\RuleResult;
use App\Enums\Flag;
use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;
use App\Enums\RefundStatus;
use App\Enums\RuleOutcome;

function engine_decides(array $overrides): array
{
    $decision = PolicyEngine::default()->evaluate(policy_context($overrides));

    return [$decision->status, $decision->decisiveRuleIds, Flag::normalize($decision->flags)];
}

it('evaluates every rule in order', function (): void {
    $decision = PolicyEngine::default()->evaluate(policy_context());

    expect(array_map(static fn (RuleResult $result): string => $result->ruleId, $decision->results))
        ->toBe(['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10']);
});

it('decides the seeded scenarios', function (array $overrides, RefundStatus $status, array $decisive, array $flags): void {
    expect(engine_decides($overrides))->toBe([$status, $decisive, $flags]);
})->with([
    '1 damaged blender' => [[], RefundStatus::Approved, ['R08'], []],
    '3 final sale, changed mind' => [
        ['finalSaleItemIds' => ['item-1'], 'reasonCategory' => ReasonCategory::ChangedMind],
        RefundStatus::Denied, ['R04'], [],
    ],
    '4 damaged, delivered 60 days ago' => [['daysSinceDelivery' => 60], RefundStatus::Denied, ['R03'], []],
    '5 damaged laptop over $500' => [['amountCents' => 129900], RefundStatus::Escalated, ['R06'], []],
    '6 changed mind on day 7' => [
        ['reasonCategory' => ReasonCategory::ChangedMind, 'daysSinceDelivery' => 7],
        RefundStatus::Approved, ['R09'], [],
    ],
    '7 changed mind on day 20' => [
        ['reasonCategory' => ReasonCategory::ChangedMind, 'daysSinceDelivery' => 20],
        RefundStatus::Denied, ['R09'], [],
    ],
    '8 four recent refunds' => [['recentApprovedRefunds' => 4], RefundStatus::Escalated, ['R07'], ['HIGH_REFUND_FREQUENCY']],
    '9 never arrived but delivered' => [
        ['reasonCategory' => ReasonCategory::NotReceived],
        RefundStatus::Escalated, ['R07', 'R10'], ['CLAIM_CONFLICT'],
    ],
    '10 order still processing' => [
        ['orderStatus' => OrderStatus::Processing, 'daysSinceDelivery' => null, 'reasonCategory' => ReasonCategory::ChangedMind],
        RefundStatus::Denied, ['R02'], [],
    ],
    '11 already refunded' => [
        ['alreadyRefundedItemIds' => ['item-1'], 'reasonCategory' => ReasonCategory::Defective],
        RefundStatus::Denied, ['R05'], [],
    ],
    '12 prompt injection' => [
        ['reasonCategory' => ReasonCategory::Other, 'injectionSuspected' => true, 'heuristicMatches' => ['decision_override', 'ignore_instructions']],
        RefundStatus::Escalated, ['R07', 'R10'], ['INJECTION_HEURISTIC', 'INJECTION_MODEL'],
    ],
    '13 damaged final sale item' => [['finalSaleItemIds' => ['item-1']], RefundStatus::Escalated, ['R04'], []],
    '14 two items totalling $530' => [['amountCents' => 53000], RefundStatus::Escalated, ['R06'], []],
]);

describe('precedence', function (): void {
    it('lets deny beat escalate and approve', function (): void {
        [$status, $decisive] = engine_decides([
            'daysSinceDelivery' => 45,          // R03 deny
            'amountCents' => 90000,             // R06 escalate
            'recentApprovedRefunds' => 3,       // R07 escalate
        ]);

        expect($status)->toBe(RefundStatus::Denied)->and($decisive)->toBe(['R03']);
    });

    it('lists every deny rule in rule order', function (): void {
        [$status, $decisive] = engine_decides([
            'orderStatus' => OrderStatus::Shipped,
            'daysSinceDelivery' => null,
            'finalSaleItemIds' => ['item-1'],
            'alreadyRefundedItemIds' => ['item-1'],
            'reasonCategory' => ReasonCategory::ChangedMind,
        ]);

        expect($status)->toBe(RefundStatus::Denied)->and($decisive)->toBe(['R02', 'R04', 'R05']);
    });

    it('lets escalate beat approve', function (): void {
        [$status, $decisive] = engine_decides(['amountCents' => 50001]);

        expect($status)->toBe(RefundStatus::Escalated)->and($decisive)->toBe(['R06']);
    });

    it('approves at exactly $500.00', function (): void {
        expect(engine_decides(['amountCents' => 50000])[0])->toBe(RefundStatus::Approved);
    });

    it('escalates as a fail safe when no rule has an opinion', function (): void {
        $engine = new PolicyEngine([
            new class implements PolicyRule
            {
                public function evaluate(PolicyContext $ctx): RuleResult
                {
                    return RuleResult::pass('X01', 'No objection');
                }
            },
        ]);

        $decision = $engine->evaluate(policy_context());

        expect($decision->status)->toBe(RefundStatus::Escalated)
            ->and($decision->decisiveRuleIds)->toBe([]);
    });
});

describe('fail-safe behaviour', function (): void {
    it('escalates a final sale item reported damaged', function (): void {
        $decision = PolicyEngine::default()->evaluate(policy_context([
            'finalSaleItemIds' => ['item-1'],
            'reasonCategory' => ReasonCategory::Damaged,
        ]));

        expect($decision->status)->toBe(RefundStatus::Escalated)
            ->and($decision->decisiveRuleIds)->toBe(['R04'])
            ->and($decision->results[3]->outcome)->toBe(RuleOutcome::Escalate);
    });

    it('escalates when the AI is unavailable', function (): void {
        [$status, $decisive, $flags] = engine_decides([
            'aiAvailable' => false,
            'reasonCategory' => null,
            'confidence' => null,
        ]);

        expect($status)->toBe(RefundStatus::Escalated)
            ->and($decisive)->toBe(['R07', 'R10'])
            ->and($flags)->toBe(['AI_UNAVAILABLE']);
    });

    it('escalates a final sale item when the AI is unavailable', function (): void {
        [$status, $decisive] = engine_decides([
            'aiAvailable' => false,
            'reasonCategory' => null,
            'confidence' => null,
            'finalSaleItemIds' => ['item-1'],
        ]);

        expect($status)->toBe(RefundStatus::Escalated)->and($decisive)->toBe(['R04', 'R07', 'R10']);
    });

    it('still denies an out-of-window request when the AI is unavailable', function (): void {
        [$status, $decisive] = engine_decides([
            'aiAvailable' => false,
            'reasonCategory' => null,
            'confidence' => null,
            'daysSinceDelivery' => 31,
        ]);

        expect($status)->toBe(RefundStatus::Denied)->and($decisive)->toBe(['R03']);
    });

    it('never approves when injection is suspected, even for an approvable reason', function (): void {
        [$status, $decisive, $flags] = engine_decides([
            'reasonCategory' => ReasonCategory::Damaged,
            'heuristicMatches' => ['role_tags'],
        ]);

        expect($status)->toBe(RefundStatus::Escalated)
            ->and($decisive)->toBe(['R07'])
            ->and($flags)->toBe(['INJECTION_HEURISTIC']);
    });

    it('escalates an unclear reason once clarification is exhausted', function (): void {
        [$status, $decisive, $flags] = engine_decides([
            'reasonCategory' => ReasonCategory::Unclear,
            'confidence' => 0.3,
            'clarificationExhausted' => true,
        ]);

        expect($status)->toBe(RefundStatus::Escalated)
            ->and($decisive)->toBe(['R07', 'R10'])
            ->and($flags)->toBe(['LOW_CONFIDENCE']);
    });
});
