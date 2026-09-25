<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Data\RefundRequestDetail;
use App\Models\RefundRequestItem;
use App\Support\Iso8601;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read RefundRequestDetail $resource
 */
final class RefundRequestDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $refund = $this->resource->refundRequest;

        return [
            ...RefundRequestSummaryResource::summary($refund),
            'items' => $refund->items->map(static fn (RefundRequestItem $item): array => [
                'orderItemId' => $item->order_item_id,
                'sku' => $item->orderItem->sku,
                'name' => $item->orderItem->name,
                'quantity' => $item->orderItem->quantity,
                'amountCents' => $item->amount_cents,
                'finalSale' => $item->orderItem->final_sale,
            ])->values()->all(),
            'conversation' => [
                'id' => $refund->conversation_id,
                'messages' => MessageResource::collection($refund->conversation->messages ?? []),
            ],
            'trace' => $refund->trace,
            'review' => $refund->review_decision === null ? null : [
                'decision' => $refund->review_decision->value,
                'note' => $refund->review_note,
                'reviewer' => $refund->reviewed_by,
                'reviewedAt' => Iso8601::formatOrNull($refund->reviewed_at),
            ],
            'auditEvents' => AuditEventResource::collection($this->resource->auditEvents),
        ];
    }
}
