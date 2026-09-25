<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\ReviewDecision;

final readonly class ReviewData
{
    public function __construct(
        public ReviewDecision $decision,
        public string $note,
        public string $reviewer = 'admin',
    ) {}
}
