<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy;

use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;

/**
 * Everything the rules may look at. Facts come from the database; signals come from the model and
 * the heuristic detector. The model never supplies an amount or a decision.
 */
final readonly class PolicyContext
{
    /**
     * @param  list<string>  $selectedItemIds
     * @param  list<string>  $finalSaleItemIds  selected items marked final sale
     * @param  list<string>  $alreadyRefundedItemIds  selected items with an approved or pending refund
     * @param  list<string>  $heuristicMatches  ids of injection patterns that matched
     * @param  bool  $aiAvailable  false when extraction failed twice; the signal fields are then ignored
     */
    public function __construct(
        public PolicyConfig $config,
        public string $verifiedCustomerId,
        public string $orderCustomerId,
        public OrderStatus $orderStatus,
        public ?int $daysSinceDelivery,
        public int $amountCents,
        public array $selectedItemIds,
        public array $finalSaleItemIds,
        public array $alreadyRefundedItemIds,
        public int $recentApprovedRefunds,
        public bool $aiAvailable,
        public ?ReasonCategory $reasonCategory,
        public bool $claimsConflict,
        public bool $injectionSuspected,
        public ?float $confidence,
        public array $heuristicMatches,
        public bool $clarificationExhausted,
    ) {}

    public function isDelivered(): bool
    {
        return $this->orderStatus === OrderStatus::Delivered && $this->daysSinceDelivery !== null;
    }

    public function withinRefundWindow(): bool
    {
        return $this->isDelivered() && $this->daysSinceDelivery <= $this->config->refundWindowDays;
    }
}
