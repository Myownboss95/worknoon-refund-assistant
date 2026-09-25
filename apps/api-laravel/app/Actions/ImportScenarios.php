<?php

declare(strict_types=1);

namespace App\Actions;

use App\Data\ResetResult;
use App\Domain\Refunds\Policy\PolicyConfig;
use App\Enums\DecidedBy;
use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;
use App\Enums\RefundStatus;
use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RefundRequest;
use App\Models\RefundRequestItem;
use App\Support\ContractFiles;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Seeds customers, orders and refund history from contracts/scenarios.json, with every date
 * relative to now so the scenarios stay valid whenever the project runs.
 */
final readonly class ImportScenarios
{
    public function __construct(
        private ContractFiles $contracts,
        private PolicyConfig $config,
    ) {}

    public function __invoke(): ResetResult
    {
        $scenarios = $this->contracts->json('scenarios.json');
        $customers = $scenarios['customers'] ?? null;

        if (! is_array($customers)) {
            throw new InvalidArgumentException('scenarios.json has no customers.');
        }

        $now = CarbonImmutable::now();
        $currency = $this->config->currency;

        return DB::transaction(function () use ($customers, $now, $currency): ResetResult {
            $orderCount = 0;

            foreach ($customers as $customerData) {
                /** @var array<string, mixed> $customerData */
                $orderCount += $this->importCustomer($customerData, $now, $currency);
            }

            return new ResetResult(count($customers), $orderCount);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function importCustomer(array $data, CarbonImmutable $now, string $currency): int
    {
        $customer = Customer::query()->create([
            'name' => self::string($data, 'name'),
            'email' => mb_strtolower(trim(self::string($data, 'email'))),
        ]);

        /** @var array<string, array<string, OrderItem>> $itemsBySku order number => sku => item */
        $itemsBySku = [];
        /** @var array<string, Order> $orders */
        $orders = [];

        foreach (self::list($data, 'orders') as $orderData) {
            $deliveredDaysAgo = $orderData['deliveredDaysAgo'] ?? null;

            $order = Order::query()->create([
                'customer_id' => $customer->id,
                'order_number' => strtoupper(self::string($orderData, 'orderNumber')),
                'status' => OrderStatus::from(self::string($orderData, 'status')),
                'placed_at' => $now->subDays(self::int($orderData, 'placedDaysAgo')),
                'delivered_at' => is_int($deliveredDaysAgo) ? $now->subDays($deliveredDaysAgo) : null,
            ]);

            $orders[$order->order_number] = $order;

            foreach (self::list($orderData, 'items') as $itemData) {
                $item = OrderItem::query()->create([
                    'order_id' => $order->id,
                    'sku' => self::string($itemData, 'sku'),
                    'name' => self::string($itemData, 'name'),
                    'unit_price_cents' => self::int($itemData, 'unitPriceCents'),
                    'quantity' => self::int($itemData, 'quantity'),
                    'final_sale' => (bool) ($itemData['finalSale'] ?? false),
                ]);

                $itemsBySku[$order->order_number][$item->sku] = $item;
            }
        }

        foreach (self::list($data, 'refundHistory') as $history) {
            $orderNumber = strtoupper(self::string($history, 'orderNumber'));
            $item = $itemsBySku[$orderNumber][self::string($history, 'sku')]
                ?? throw new InvalidArgumentException("Refund history refers to an unknown item on {$orderNumber}.");
            $createdAt = $now->subDays(self::int($history, 'daysAgo'));
            $amount = $item->lineTotalCents();

            $refund = RefundRequest::query()->create([
                'conversation_id' => null,
                'customer_id' => $customer->id,
                'order_id' => $orders[$orderNumber]->id,
                'status' => RefundStatus::from(self::string($history, 'status')),
                'decided_by' => DecidedBy::Import,
                'reason_category' => ReasonCategory::tryFrom((string) ($history['reasonCategory'] ?? '')),
                'amount_cents' => $amount,
                'currency' => $currency,
                'decisive_rule_ids' => [],
                'flags' => [],
                'trace' => null,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            RefundRequestItem::query()->create([
                'refund_request_id' => $refund->id,
                'order_item_id' => $item->id,
                'amount_cents' => $amount,
            ]);
        }

        return count($orders);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function string(array $data, string $key): string
    {
        return is_string($data[$key] ?? null) ? $data[$key] : throw new InvalidArgumentException("scenarios.json: [{$key}] must be a string.");
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function int(array $data, string $key): int
    {
        return is_int($data[$key] ?? null) ? $data[$key] : throw new InvalidArgumentException("scenarios.json: [{$key}] must be an integer.");
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<array<string, mixed>>
     */
    private static function list(array $data, string $key): array
    {
        $value = $data[$key] ?? [];

        /** @var list<array<string, mixed>> */
        return is_array($value) ? array_values($value) : [];
    }
}
