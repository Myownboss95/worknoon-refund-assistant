<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $refund_request_id
 * @property string $order_item_id
 * @property int $amount_cents
 * @property-read RefundRequest $refundRequest
 * @property-read OrderItem $orderItem
 */
#[Table(name: 'refund_request_items', timestamps: false)]
#[Fillable(['refund_request_id', 'order_item_id', 'amount_cents'])]
final class RefundRequestItem extends Model
{
    use HasUuids;

    /**
     * @return BelongsTo<RefundRequest, $this>
     */
    public function refundRequest(): BelongsTo
    {
        return $this->belongsTo(RefundRequest::class);
    }

    /**
     * @return BelongsTo<OrderItem, $this>
     */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
        ];
    }
}
