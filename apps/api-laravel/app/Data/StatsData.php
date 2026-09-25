<?php

declare(strict_types=1);

namespace App\Data;

final readonly class StatsData
{
    public function __construct(
        public int $total,
        public int $approved,
        public int $denied,
        public int $escalated,
        public int $escalatedTotal,
        public int $humanReviewed,
        public float $escalationRate,
        public float $autoResolutionRate,
    ) {}
}
