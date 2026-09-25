<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property string $id
 * @property string $order_id
 * @property string $sku
 * @property string $name
 * @property int $unit_price_cents
 * @property int $quantity
 * @property bool $final_sale
 * @property-read Order $order
 * @property-read Collection<int, RefundRequest> $refundRequests
 */
#[Table(name: 'order_items', timestamps: false)]
#[Fillable(['order_id', 'sku', 'name', 'unit_price_cents', 'quantity', 'final_sale'])]
final class OrderItem extends Model
{
    use HasUuids;

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Every refund request (any status) that covers this item.
     *
     * @return BelongsToMany<RefundRequest, $this>
     */
    public function refundRequests(): BelongsToMany
    {
        return $this->belongsToMany(RefundRequest::class, 'refund_request_items');
    }

    public function lineTotalCents(): int
    {
        return $this->unit_price_cents * $this->quantity;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit_price_cents' => 'integer',
            'quantity' => 'integer',
            'final_sale' => 'boolean',
        ];
    }
}
