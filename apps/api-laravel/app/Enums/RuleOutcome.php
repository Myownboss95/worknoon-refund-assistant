<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * What a single policy rule says about a request.
 */
enum RuleOutcome: string
{
    case Pass = 'pass';
    case NotApplicable = 'not_applicable';
    case Deny = 'deny';
    case Escalate = 'escalate';
    case Approve = 'approve';

    /**
     * The rule outcome that produces the given final status, used to pick decisive rules.
     */
    public static function producing(RefundStatus $status): self
    {
        return match ($status) {
            RefundStatus::Approved => self::Approve,
            RefundStatus::Denied => self::Deny,
            RefundStatus::Escalated => self::Escalate,
        };
    }
}
