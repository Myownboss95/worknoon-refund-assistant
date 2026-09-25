<?php

declare(strict_types=1);

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
use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;
use App\Enums\RuleOutcome;

describe('R01 order ownership', function (): void {
    it('passes when the order belongs to the verified customer', function (): void {
        $result = (new R01OrderOwnership)->evaluate(policy_context());

        expect($result->ruleId)->toBe('R01')
            ->and($result->outcome)->toBe(RuleOutcome::Pass);
    });

    it('denies an order that belongs to someone else', function (): void {
        $result = (new R01OrderOwnership)->evaluate(policy_context(['orderCustomerId' => 'customer-2']));

        expect($result->outcome)->toBe(RuleOutcome::Deny);
    });
});

describe('R02 order delivered', function (): void {
    it('evaluates the order status', function (OrderStatus $status, ?int $days, RuleOutcome $expected): void {
        $result = (new R02OrderDelivered)->evaluate(policy_context(['orderStatus' => $status, 'daysSinceDelivery' => $days]));

        expect($result->outcome)->toBe($expected);
    })->with([
        'delivered' => [OrderStatus::Delivered, 5, RuleOutcome::Pass],
        'processing' => [OrderStatus::Processing, null, RuleOutcome::Deny],
        'shipped' => [OrderStatus::Shipped, null, RuleOutcome::Deny],
    ]);
});

describe('R03 refund window', function (): void {
    it('allows up to 30 whole days after delivery', function (int $days, RuleOutcome $expected): void {
        $result = (new R03RefundWindow)->evaluate(policy_context(['daysSinceDelivery' => $days]));

        expect($result->outcome)->toBe($expected);
    })->with([
        'day 0' => [0, RuleOutcome::Pass],
        'day 29' => [29, RuleOutcome::Pass],
        'day 30 (last day)' => [30, RuleOutcome::Pass],
        'day 31' => [31, RuleOutcome::Deny],
        'day 60' => [60, RuleOutcome::Deny],
    ]);

    it('does not apply to undelivered orders', function (): void {
        $result = (new R03RefundWindow)->evaluate(policy_context([
            'orderStatus' => OrderStatus::Processing,
            'daysSinceDelivery' => null,
        ]));

        expect($result->outcome)->toBe(RuleOutcome::NotApplicable);
    });
});

describe('R04 final sale', function (): void {
    it('passes when no selected item is final sale', function (): void {
        expect((new R04FinalSale)->evaluate(policy_context())->outcome)->toBe(RuleOutcome::Pass);
    });

    it('decides final sale items by reason', function (?ReasonCategory $reason, bool $aiAvailable, RuleOutcome $expected): void {
        $result = (new R04FinalSale)->evaluate(policy_context([
            'finalSaleItemIds' => ['item-1'],
            'reasonCategory' => $reason,
            'aiAvailable' => $aiAvailable,
        ]));

        expect($result->outcome)->toBe($expected);
    })->with([
        'changed mind' => [ReasonCategory::ChangedMind, true, RuleOutcome::Deny],
        'other' => [ReasonCategory::Other, true, RuleOutcome::Deny],
        'not received' => [ReasonCategory::NotReceived, true, RuleOutcome::Deny],
        'unclear' => [ReasonCategory::Unclear, true, RuleOutcome::Deny],
        'damaged (merchant fault)' => [ReasonCategory::Damaged, true, RuleOutcome::Escalate],
        'defective (merchant fault)' => [ReasonCategory::Defective, true, RuleOutcome::Escalate],
        'wrong item (merchant fault)' => [ReasonCategory::WrongItem, true, RuleOutcome::Escalate],
        'unknown (AI unavailable)' => [null, false, RuleOutcome::Escalate],
    ]);
});

describe('R05 refund once per item', function (): void {
    it('denies items that already have an approved or pending refund', function (array $refunded, RuleOutcome $expected): void {
        $result = (new R05RefundOncePerItem)->evaluate(policy_context(['alreadyRefundedItemIds' => $refunded]));

        expect($result->outcome)->toBe($expected);
    })->with([
        'none' => [[], RuleOutcome::Pass],
        'one' => [['item-1'], RuleOutcome::Deny],
    ]);
});

describe('R06 human review threshold', function (): void {
    it('escalates totals strictly above $500.00', function (int $cents, RuleOutcome $expected): void {
        $result = (new R06HumanReviewThreshold)->evaluate(policy_context(['amountCents' => $cents]));

        expect($result->outcome)->toBe($expected);
    })->with([
        '$0.01' => [1, RuleOutcome::Pass],
        '$499.99' => [49999, RuleOutcome::Pass],
        '$500.00 (at threshold)' => [50000, RuleOutcome::Pass],
        '$500.01' => [50001, RuleOutcome::Escalate],
        '$1,299.00' => [129900, RuleOutcome::Escalate],
    ]);
});

describe('R07 suspicious signals', function (): void {
    it('passes with no signals', function (): void {
        $result = (new R07SuspiciousSignals)->evaluate(policy_context());

        expect($result->outcome)->toBe(RuleOutcome::Pass)
            ->and($result->flags)->toBe([]);
    });

    it('escalates and flags each signal', function (array $overrides, array $flags): void {
        $result = (new R07SuspiciousSignals)->evaluate(policy_context($overrides));

        expect($result->outcome)->toBe(RuleOutcome::Escalate)
            ->and(Flag::normalize($result->flags))->toBe($flags);
    })->with([
        '3 recent approved refunds' => [['recentApprovedRefunds' => 3], ['HIGH_REFUND_FREQUENCY']],
        '4 recent approved refunds' => [['recentApprovedRefunds' => 4], ['HIGH_REFUND_FREQUENCY']],
        'model claims conflict' => [['claimsConflict' => true], ['CLAIM_CONFLICT']],
        'not received but delivered' => [['reasonCategory' => ReasonCategory::NotReceived], ['CLAIM_CONFLICT']],
        'heuristic injection' => [['heuristicMatches' => ['ignore_instructions']], ['INJECTION_HEURISTIC']],
        'model injection' => [['injectionSuspected' => true], ['INJECTION_MODEL']],
        'confidence 0.59' => [['confidence' => 0.59], ['LOW_CONFIDENCE']],
        'unclear after clarification limit' => [
            ['reasonCategory' => ReasonCategory::Unclear, 'confidence' => 0.9, 'clarificationExhausted' => true],
            ['LOW_CONFIDENCE'],
        ],
        'AI unavailable' => [
            ['aiAvailable' => false, 'reasonCategory' => null, 'confidence' => null],
            ['AI_UNAVAILABLE'],
        ],
        'several at once' => [
            ['recentApprovedRefunds' => 5, 'heuristicMatches' => ['jailbreak'], 'injectionSuspected' => true, 'confidence' => 0.2],
            ['HIGH_REFUND_FREQUENCY', 'INJECTION_HEURISTIC', 'INJECTION_MODEL', 'LOW_CONFIDENCE'],
        ],
    ]);

    it('does not flag 2 recent approved refunds or confidence at the minimum', function (): void {
        $result = (new R07SuspiciousSignals)->evaluate(policy_context([
            'recentApprovedRefunds' => 2,
            'confidence' => 0.6,
        ]));

        expect($result->outcome)->toBe(RuleOutcome::Pass);
    });

    it('does not treat not received on an undelivered order as a conflict', function (): void {
        $result = (new R07SuspiciousSignals)->evaluate(policy_context([
            'reasonCategory' => ReasonCategory::NotReceived,
            'orderStatus' => OrderStatus::Shipped,
            'daysSinceDelivery' => null,
        ]));

        expect($result->outcome)->toBe(RuleOutcome::Pass);
    });

    it('does not flag an unclear reason before the clarification limit', function (): void {
        $result = (new R07SuspiciousSignals)->evaluate(policy_context([
            'reasonCategory' => ReasonCategory::Unclear,
            'confidence' => 0.9,
        ]));

        expect($result->outcome)->toBe(RuleOutcome::Pass);
    });
});

describe('R08 merchant fault', function (): void {
    it('approves damaged, defective and wrong items within the window', function (ReasonCategory $reason, int $days, RuleOutcome $expected): void {
        $result = (new R08MerchantFault)->evaluate(policy_context(['reasonCategory' => $reason, 'daysSinceDelivery' => $days]));

        expect($result->outcome)->toBe($expected);
    })->with([
        'damaged' => [ReasonCategory::Damaged, 5, RuleOutcome::Approve],
        'defective' => [ReasonCategory::Defective, 5, RuleOutcome::Approve],
        'wrong item' => [ReasonCategory::WrongItem, 30, RuleOutcome::Approve],
        'damaged after the window' => [ReasonCategory::Damaged, 31, RuleOutcome::NotApplicable],
        'changed mind' => [ReasonCategory::ChangedMind, 5, RuleOutcome::NotApplicable],
        'not received' => [ReasonCategory::NotReceived, 5, RuleOutcome::NotApplicable],
    ]);

    it('does not apply to undelivered orders', function (): void {
        $result = (new R08MerchantFault)->evaluate(policy_context([
            'orderStatus' => OrderStatus::Processing,
            'daysSinceDelivery' => null,
        ]));

        expect($result->outcome)->toBe(RuleOutcome::NotApplicable);
    });
});

describe('R09 change of mind', function (): void {
    it('allows change of mind for 14 days after delivery', function (int $days, RuleOutcome $expected): void {
        $result = (new R09ChangeOfMind)->evaluate(policy_context([
            'reasonCategory' => ReasonCategory::ChangedMind,
            'daysSinceDelivery' => $days,
        ]));

        expect($result->outcome)->toBe($expected);
    })->with([
        'day 7' => [7, RuleOutcome::Approve],
        'day 14 (last day)' => [14, RuleOutcome::Approve],
        'day 15' => [15, RuleOutcome::Deny],
        'day 20' => [20, RuleOutcome::Deny],
    ]);

    it('does not apply to other reasons or undelivered orders', function (array $overrides): void {
        expect((new R09ChangeOfMind)->evaluate(policy_context($overrides))->outcome)->toBe(RuleOutcome::NotApplicable);
    })->with([
        'damaged' => [['reasonCategory' => ReasonCategory::Damaged]],
        'processing' => [['reasonCategory' => ReasonCategory::ChangedMind, 'orderStatus' => OrderStatus::Processing, 'daysSinceDelivery' => null]],
    ]);
});

describe('R10 no automatic approval path', function (): void {
    it('only lets approvable reasons through', function (?ReasonCategory $reason, bool $aiAvailable, RuleOutcome $expected): void {
        $result = (new R10NoAutomaticApprovalPath)->evaluate(policy_context([
            'reasonCategory' => $reason,
            'aiAvailable' => $aiAvailable,
        ]));

        expect($result->outcome)->toBe($expected);
    })->with([
        'damaged' => [ReasonCategory::Damaged, true, RuleOutcome::Pass],
        'defective' => [ReasonCategory::Defective, true, RuleOutcome::Pass],
        'wrong item' => [ReasonCategory::WrongItem, true, RuleOutcome::Pass],
        'changed mind' => [ReasonCategory::ChangedMind, true, RuleOutcome::Pass],
        'not received' => [ReasonCategory::NotReceived, true, RuleOutcome::Escalate],
        'other' => [ReasonCategory::Other, true, RuleOutcome::Escalate],
        'unclear' => [ReasonCategory::Unclear, true, RuleOutcome::Escalate],
        'unknown (AI unavailable)' => [null, false, RuleOutcome::Escalate],
    ]);
});
