<?php

declare(strict_types=1);

namespace App\Actions;

use App\Data\RefundRequestFilters;
use App\Models\RefundRequest;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * GET /admin/refund-requests: assistant-created requests only, newest first.
 */
final class ListRefundRequests
{
    /**
     * @return LengthAwarePaginator<int, RefundRequest>
     */
    public function __invoke(RefundRequestFilters $filters): LengthAwarePaginator
    {
        return RefundRequest::query()
            ->assistantCreated()
            ->with(['customer', 'order'])
            ->when($filters->status, static fn ($query, $status) => $query->where('status', $status))
            ->newestFirst()
            ->paginate(perPage: $filters->perPage, page: $filters->page);
    }
}
