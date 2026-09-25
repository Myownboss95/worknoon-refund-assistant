<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\RefundStatus;

final readonly class RefundRequestFilters
{
    public function __construct(
        public ?RefundStatus $status = null,
        public int $page = 1,
        public int $perPage = 20,
    ) {}
}
