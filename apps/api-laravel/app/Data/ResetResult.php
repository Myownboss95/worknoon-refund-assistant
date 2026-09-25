<?php

declare(strict_types=1);

namespace App\Data;

final readonly class ResetResult
{
    public function __construct(
        public int $customers,
        public int $orders,
    ) {}
}
