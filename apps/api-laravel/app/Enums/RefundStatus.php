<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Current status of a refund request.
 */
enum RefundStatus: string
{
    case Approved = 'approved';
    case Denied = 'denied';
    case Escalated = 'escalated';

    public static function fromReview(ReviewDecision $decision): self
    {
        return match ($decision) {
            ReviewDecision::Approve => self::Approved,
            ReviewDecision::Deny => self::Denied,
        };
    }
}
