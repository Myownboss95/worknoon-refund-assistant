<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Domain\Refunds\Policy\PolicyConfig;
use App\Domain\Refunds\Support\CustomerReason;
use App\Models\RefundRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Customer-safe view of a decision: never includes flags or internal rule reasons.
 *
 * @property-read RefundRequest $resource
 */
final class DecisionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $refund = $this->resource;

        return [
            'refundRequestId' => $refund->id,
            'status' => $refund->status->value,
            'decidedBy' => $refund->decided_by->value,
            'amountCents' => $refund->amount_cents,
            'currency' => $refund->currency,
            'decisiveRuleIds' => $refund->decisive_rule_ids,
            'customerReason' => CustomerReason::for(
                $refund->status,
                $refund->decided_by,
                $refund->decisive_rule_ids,
                $refund->amount_cents,
                app(PolicyConfig::class),
            ),
        ];
    }
}
