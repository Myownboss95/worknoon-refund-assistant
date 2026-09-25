<?php

declare(strict_types=1);

namespace App\Queries;

use App\Domain\Refunds\Support\ItemRefundState;
use App\Enums\RefundStatus;
use Illuminate\Support\Facades\DB;

/**
 * Refund state of order items, straight from the database (used for policy facts and for the
 * race check inside the decision transaction).
 */
final class ItemRefundStates
{
    /**
     * @param  list<string>  $orderItemIds
     * @return array<string, string|null> item id to `approved`, `pending` or null
     */
    public function forItems(array $orderItemIds): array
    {
        $rows = DB::table('refund_request_items')
            ->join('refund_requests', 'refund_requests.id', '=', 'refund_request_items.refund_request_id')
            ->whereIn('refund_request_items.order_item_id', $orderItemIds)
            ->whereIn('refund_requests.status', [RefundStatus::Approved->value, RefundStatus::Escalated->value])
            ->get(['refund_request_items.order_item_id', 'refund_requests.status']);

        $statuses = [];

        foreach ($rows as $row) {
            /** @var object{order_item_id: string, status: string} $row */
            $statuses[$row->order_item_id][] = RefundStatus::from($row->status);
        }

        $states = [];

        foreach ($orderItemIds as $id) {
            $states[$id] = ItemRefundState::from($statuses[$id] ?? []);
        }

        return $states;
    }

    /**
     * The given items that already have an approved or pending refund, in the given order.
     *
     * @param  list<string>  $orderItemIds
     * @return list<string>
     */
    public function blocked(array $orderItemIds): array
    {
        return array_keys(array_filter(
            $this->forItems($orderItemIds),
            static fn (?string $state): bool => $state !== null,
        ));
    }
}
