<?php

declare(strict_types=1);

namespace App\Data;

final readonly class ExtractionInput
{
    /**
     * @param  list<string>  $customerMessages  every customer message in the conversation, oldest first
     */
    public function __construct(
        public array $customerMessages,
        public string $latestMessage,
        public OrderContext $orderContext,
    ) {}
}
