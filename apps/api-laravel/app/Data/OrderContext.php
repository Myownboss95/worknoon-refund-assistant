<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\OrderStatus;

/**
 * Trusted facts about the order, sent to the model alongside the customer's messages.
 */
final readonly class OrderContext
{
    /**
     * @param  list<OrderContextItem>  $selectedItems
     */
    public function __construct(
        public string $orderNumber,
        public OrderStatus $status,
        public ?int $daysSinceDelivery,
        public array $selectedItems,
    ) {}

    /**
     * @return array{orderNumber: string, status: string, daysSinceDelivery: int|null, selectedItems: list<array{name: string, quantity: int, finalSale: bool}>}
     */
    public function toArray(): array
    {
        return [
            'orderNumber' => $this->orderNumber,
            'status' => $this->status->value,
            'daysSinceDelivery' => $this->daysSinceDelivery,
            'selectedItems' => array_map(
                static fn (OrderContextItem $item): array => $item->toArray(),
                $this->selectedItems,
            ),
        ];
    }
}
