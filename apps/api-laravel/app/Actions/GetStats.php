<?php

declare(strict_types=1);

namespace App\Actions;

use App\Data\StatsData;
use App\Enums\DecidedBy;
use App\Enums\RefundStatus;
use App\Models\RefundRequest;

/**
 * GET /admin/stats over assistant-created requests (imported history is excluded).
 */
final class GetStats
{
    public function __invoke(): StatsData
    {
        $row = RefundRequest::query()
            ->assistantCreated()
            ->toBase()
            ->selectRaw('count(*) as total')
            ->selectRaw('count(*) filter (where status = ?) as approved', [RefundStatus::Approved->value])
            ->selectRaw('count(*) filter (where status = ?) as denied', [RefundStatus::Denied->value])
            ->selectRaw('count(*) filter (where status = ?) as escalated', [RefundStatus::Escalated->value])
            ->selectRaw('count(*) filter (where status = ? or decided_by = ?) as escalated_total', [RefundStatus::Escalated->value, DecidedBy::Human->value])
            ->selectRaw('count(*) filter (where decided_by = ?) as human_reviewed', [DecidedBy::Human->value])
            ->selectRaw('count(*) filter (where decided_by = ? and status in (?, ?)) as auto_resolved', [
                DecidedBy::Policy->value, RefundStatus::Approved->value, RefundStatus::Denied->value,
            ])
            ->first();

        $count = static fn (string $column): int => (int) ($row->{$column} ?? 0);
        $total = $count('total');
        $rate = static fn (int $part): float => $total === 0 ? 0.0 : round($part / $total, 4);

        return new StatsData(
            total: $total,
            approved: $count('approved'),
            denied: $count('denied'),
            escalated: $count('escalated'),
            escalatedTotal: $count('escalated_total'),
            humanReviewed: $count('human_reviewed'),
            escalationRate: $rate($count('escalated_total')),
            autoResolutionRate: $rate($count('auto_resolved')),
        );
    }
}
