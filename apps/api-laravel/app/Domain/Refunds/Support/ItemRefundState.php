<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Support;

use App\Enums\RefundStatus;

/**
 * An order item's refund state: `approved` if any approved request covers it, else `pending` if any
 * escalated one does, else null. Denied requests never block a new attempt.
 */
final class ItemRefundState
{
    public const string APPROVED = 'approved';

    public const string PENDING = 'pending';

    /**
     * @param  iterable<RefundStatus>  $statuses  statuses of every refund request covering the item
     */
    public static function from(iterable $statuses): ?string
    {
        $pending = false;

        foreach ($statuses as $status) {
            if ($status === RefundStatus::Approved) {
                return self::APPROVED;
            }

            $pending = $pending || $status === RefundStatus::Escalated;
        }

        return $pending ? self::PENDING : null;
    }
}
