<?php

declare(strict_types=1);

namespace App\Data;

final readonly class OrderContextItem
{
    public function __construct(
        public string $name,
        public int $quantity,
        public bool $finalSale,
    ) {}

    /**
     * @return array{name: string, quantity: int, finalSale: bool}
     */
    public function toArray(): array
    {
        return ['name' => $this->name, 'quantity' => $this->quantity, 'finalSale' => $this->finalSale];
    }
}
