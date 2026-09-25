<?php

declare(strict_types=1);

namespace App\Data;

use App\Models\OrderItem;

/**
 * The order items a customer selected for one refund request, in the order they picked them.
 */
final readonly class SelectedItems
{
    /**
     * @param  list<OrderItem>  $items
     */
    public function __construct(public array $items) {}

    /**
     * @return list<string>
     */
    public function ids(): array
    {
        return array_map(static fn (OrderItem $item): string => $item->id, $this->items);
    }

    /**
     * @return list<string>
     */
    public function names(): array
    {
        return array_map(static fn (OrderItem $item): string => $item->name, $this->items);
    }

    /**
     * @return list<string>
     */
    public function finalSaleIds(): array
    {
        return array_values(array_map(
            static fn (OrderItem $item): string => $item->id,
            array_filter($this->items, static fn (OrderItem $item): bool => $item->final_sale),
        ));
    }

    /**
     * Σ unit price × quantity, from the database. Customer text is never used for amounts.
     */
    public function amountCents(): int
    {
        return array_sum(array_map(static fn (OrderItem $item): int => $item->lineTotalCents(), $this->items));
    }

    /**
     * @return list<OrderContextItem>
     */
    public function contextItems(): array
    {
        return array_map(
            static fn (OrderItem $item): OrderContextItem => new OrderContextItem($item->name, $item->quantity, $item->final_sale),
            $this->items,
        );
    }
}
