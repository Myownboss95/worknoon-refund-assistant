<?php

declare(strict_types=1);

namespace App\Data;

use App\Enums\RefundStatus;

/**
 * What the composer may know about a decision. It already contains the final outcome and amount:
 * the model only words it.
 */
final readonly class ComposeInput
{
    /**
     * @param  list<string>  $itemNames
     * @param  list<string>  $customerReasons  customer-safe reasons (denied only)
     */
    public function __construct(
        public RefundStatus $outcome,
        public string $amount,
        public string $firstName,
        public array $itemNames,
        public array $customerReasons,
        public ?string $summary,
    ) {}

    /**
     * @return array{outcome: string, amount: string, firstName: string, itemNames: list<string>, customerReasons: list<string>, summary: string|null}
     */
    public function toArray(): array
    {
        return [
            'outcome' => $this->outcome->value,
            'amount' => $this->amount,
            'firstName' => $this->firstName,
            'itemNames' => $this->itemNames,
            'customerReasons' => $this->customerReasons,
            'summary' => $this->summary,
        ];
    }
}
