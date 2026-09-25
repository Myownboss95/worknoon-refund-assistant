<?php

declare(strict_types=1);

use App\Actions\ImportScenarios;
use App\Domain\Refunds\Policy\PolicyConfig;
use App\Domain\Refunds\Policy\PolicyContext;
use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test layout
|--------------------------------------------------------------------------
|
| tests/Unit runs without booting the framework (pure policy, guards, formatting).
| tests/Feature boots the app against the pgsql test database with RefreshDatabase,
| in mock LLM mode (see phpunit.xml).
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');

/*
|--------------------------------------------------------------------------
| Contract files
|--------------------------------------------------------------------------
*/

function contract_path(string $file = ''): string
{
    return rtrim(dirname(__DIR__, 3).'/contracts/'.ltrim($file, '/'), '/');
}

/**
 * @return array<string, mixed>
 */
function contract_json(string $file): array
{
    /** @var array<string, mixed> */
    return json_decode((string) file_get_contents(contract_path($file)), true, 512, JSON_THROW_ON_ERROR);
}

/**
 * @return array<string, mixed>
 */
function scenario(int $id): array
{
    foreach (contract_json('scenarios.json')['scenarios'] as $scenario) {
        if ($scenario['id'] === $id) {
            return $scenario;
        }
    }

    throw new InvalidArgumentException("Unknown scenario {$id}");
}

/*
|--------------------------------------------------------------------------
| Policy (unit)
|--------------------------------------------------------------------------
*/

function policy_config(): PolicyConfig
{
    return PolicyConfig::fromArray(contract_json('policy.config.json'));
}

/**
 * A context for an ordinary, approvable request; override only what a test is about.
 *
 * @param  array<string, mixed>  $overrides  PolicyContext constructor arguments by name
 */
function policy_context(array $overrides = []): PolicyContext
{
    $defaults = [
        'config' => policy_config(),
        'verifiedCustomerId' => 'customer-1',
        'orderCustomerId' => 'customer-1',
        'orderStatus' => OrderStatus::Delivered,
        'daysSinceDelivery' => 5,
        'amountCents' => 8900,
        'selectedItemIds' => ['item-1'],
        'finalSaleItemIds' => [],
        'alreadyRefundedItemIds' => [],
        'recentApprovedRefunds' => 0,
        'aiAvailable' => true,
        'reasonCategory' => ReasonCategory::Damaged,
        'claimsConflict' => false,
        'injectionSuspected' => false,
        'confidence' => 0.93,
        'heuristicMatches' => [],
        'clarificationExhausted' => false,
    ];

    return new PolicyContext(...array_merge($defaults, $overrides));
}

/*
|--------------------------------------------------------------------------
| HTTP (feature)
|--------------------------------------------------------------------------
*/

function seed_scenarios(): void
{
    app(ImportScenarios::class)();
}

/**
 * @return array<string, string>
 */
function admin_headers(): array
{
    return ['X-Admin-Token' => 'test-admin-token'];
}

function verify_customer(string $email, string $orderNumber): TestResponse
{
    return test()->postJson('/api/v1/customers/verify', ['email' => $email, 'orderNumber' => $orderNumber]);
}

/**
 * Verify and return [conversationId, item ids by sku].
 *
 * @return array{0: string, 1: array<string, string>}
 */
function start_conversation(string $email, string $orderNumber): array
{
    $response = verify_customer($email, $orderNumber)->assertCreated();

    $items = [];

    foreach ($response->json('order.items') as $item) {
        $items[$item['sku']] = $item['id'];
    }

    return [$response->json('conversation.id'), $items];
}

/**
 * @param  list<string>  $itemIds
 */
function send_message(string $conversationId, string $text, array $itemIds): TestResponse
{
    return test()->postJson("/api/v1/conversations/{$conversationId}/messages", [
        'text' => $text,
        'itemIds' => $itemIds,
    ]);
}

/**
 * Start a conversation for a scenario customer and send one message about the given skus.
 *
 * @param  list<string>  $skus
 */
function request_refund(string $email, string $orderNumber, array $skus, string $text): TestResponse
{
    [$conversationId, $items] = start_conversation($email, $orderNumber);

    return send_message($conversationId, $text, array_map(static fn (string $sku): string => $items[$sku], $skus));
}

function refund_detail(string $refundRequestId): TestResponse
{
    return test()->getJson("/api/v1/admin/refund-requests/{$refundRequestId}", admin_headers())->assertOk();
}
