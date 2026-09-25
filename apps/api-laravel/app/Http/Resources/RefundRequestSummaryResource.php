<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\RefundRequest;
use App\Support\Iso8601;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Expects `customer` and `order` to be loaded.
 *
 * @property-read RefundRequest $resource
 */
final class RefundRequestSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return self::summary($this->resource);
    }

    /**
     * @return array<string, mixed>
     */
    public static function summary(RefundRequest $refund): array
    {
        return [
            'id' => $refund->id,
            'status' => $refund->status->value,
            'decidedBy' => $refund->decided_by->value,
            'customer' => [
                'name' => $refund->customer->name,
                'email' => $refund->customer->email,
            ],
            'orderNumber' => $refund->order->order_number,
            'amountCents' => $refund->amount_cents,
            'currency' => $refund->currency,
            'reasonCategory' => $refund->reason_category?->value,
            'flags' => $refund->flags,
            'decisiveRuleIds' => $refund->decisive_rule_ids,
            'createdAt' => Iso8601::format($refund->created_at),
        ];
    }
}
