<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\OrderStatus;

final readonly class TraceFacts
{
    /**
     * @param  list<string>  $finalSaleItemIds
     * @param  list<string>  $alreadyRefundedItemIds
     */
    public function __construct(
        public OrderStatus $orderStatus,
        public ?int $daysSinceDelivery,
        public int $amountCents,
        public int $recentApprovedRefunds,
        public array $finalSaleItemIds,
        public array $alreadyRefundedItemIds,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'orderStatus' => $this->orderStatus->value,
            'daysSinceDelivery' => $this->daysSinceDelivery,
            'amountCents' => $this->amountCents,
            'recentApprovedRefunds' => $this->recentApprovedRefunds,
            'finalSaleItemIds' => $this->finalSaleItemIds,
            'alreadyRefundedItemIds' => $this->alreadyRefundedItemIds,
        ];
    }
}
