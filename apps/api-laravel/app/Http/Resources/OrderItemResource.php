<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Domain\Refunds\Support\ItemRefundState;
use App\Models\OrderItem;
use App\Models\RefundRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Requires `refundRequests` to be loaded, to report the item's refund state.
 *
 * @property-read OrderItem $resource
 */
final class OrderItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $item = $this->resource;

        return [
            'id' => $item->id,
            'sku' => $item->sku,
            'name' => $item->name,
            'quantity' => $item->quantity,
            'unitPriceCents' => $item->unit_price_cents,
            'lineTotalCents' => $item->lineTotalCents(),
            'finalSale' => $item->final_sale,
            'refundStatus' => ItemRefundState::from(
                $item->refundRequests->map(static fn (RefundRequest $refund) => $refund->status),
            ),
        ];
    }
}
