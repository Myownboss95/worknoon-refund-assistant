<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Domain\Refunds\Policy\PolicyConfig;
use App\Models\Order;
use App\Models\OrderItem;
use App\Support\Iso8601;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read Order $resource
 */
final class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $order = $this->resource;

        return [
            'id' => $order->id,
            'orderNumber' => $order->order_number,
            'status' => $order->status->value,
            'placedAt' => Iso8601::format($order->placed_at),
            'deliveredAt' => Iso8601::formatOrNull($order->delivered_at),
            'totalCents' => (int) $order->items->sum(static fn (OrderItem $item): int => $item->lineTotalCents()),
            'currency' => app(PolicyConfig::class)->currency,
            'items' => OrderItemResource::collection($order->items),
        ];
    }
}
