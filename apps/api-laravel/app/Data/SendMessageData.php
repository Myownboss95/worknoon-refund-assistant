<?php

declare(strict_types=1);

namespace App\Data;

final readonly class SendMessageData
{
    /**
     * @param  string  $text  control characters stripped and trimmed
     * @param  list<string>  $itemIds  unique ids of items on the conversation's order
     */
    public function __construct(
        public string $text,
        public array $itemIds,
    ) {}
}
