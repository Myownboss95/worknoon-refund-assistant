<?php

declare(strict_types=1);

use App\Domain\Refunds\Support\CustomerReason;
use App\Enums\DecidedBy;
use App\Enums\RefundStatus;

it('explains approvals with the amount', function (): void {
    expect(CustomerReason::for(RefundStatus::Approved, DecidedBy::Policy, ['R08'], 129900, policy_config()))
        ->toBe('Your refund of $1,299.00 has been approved.');
});

it('explains escalations without an amount', function (): void {
    expect(CustomerReason::for(RefundStatus::Escalated, DecidedBy::Policy, ['R06'], 129900, policy_config()))
        ->toBe('A member of our support team will review your request within one business day.');
});

it('joins the customer-safe reasons of the deny rules, with placeholders filled', function (): void {
    expect(CustomerReason::for(RefundStatus::Denied, DecidedBy::Policy, ['R03', 'R04'], 4500, policy_config()))
        ->toBe("It was delivered more than 30 days ago, which is outside our refund window. Final sale items can't be refunded.");
});

it('fills the change-of-mind window', function (): void {
    expect(CustomerReason::forRules(['R09'], policy_config()))
        ->toBe('Change-of-mind refunds are available for 14 days after delivery, and that window has passed.');
});

it('uses a generic sentence for a human denial', function (): void {
    expect(CustomerReason::for(RefundStatus::Denied, DecidedBy::Human, ['R06'], 129900, policy_config()))
        ->toBe(CustomerReason::HUMAN_DENIED);
});
