<?php

declare(strict_types=1);

use App\Enums\ConversationStatus;
use App\Models\AuditEvent;
use App\Models\Conversation;
use App\Models\Message;

beforeEach(fn () => seed_scenarios());

it('verifies a customer and starts a conversation with a greeting', function (): void {
    $response = verify_customer('ada.okafor@example.com', 'WN-1001');

    $response->assertCreated()
        ->assertExactJsonStructure([
            'conversation' => ['id', 'status', 'clarificationTurns', 'createdAt'],
            'customer' => ['name', 'firstName'],
            'order' => [
                'id', 'orderNumber', 'status', 'placedAt', 'deliveredAt', 'totalCents', 'currency',
                'items' => ['*' => ['id', 'sku', 'name', 'quantity', 'unitPriceCents', 'lineTotalCents', 'finalSale', 'refundStatus']],
            ],
            'messages' => ['*' => ['id', 'role', 'content', 'itemIds', 'createdAt']],
        ])
        ->assertJsonPath('conversation.status', 'open')
        ->assertJsonPath('conversation.clarificationTurns', 0)
        ->assertJsonPath('customer', ['name' => 'Ada Okafor', 'firstName' => 'Ada'])
        ->assertJsonPath('order.orderNumber', 'WN-1001')
        ->assertJsonPath('order.status', 'delivered')
        ->assertJsonPath('order.totalCents', 8900)
        ->assertJsonPath('order.currency', 'USD')
        ->assertJsonPath('order.items.0.sku', 'KIT-BLND-600')
        ->assertJsonPath('order.items.0.lineTotalCents', 8900)
        ->assertJsonPath('order.items.0.refundStatus', null)
        ->assertJsonPath('messages.0.role', 'assistant')
        ->assertJsonPath('messages.0.itemIds', null)
        ->assertJsonPath('messages.0.content', 'Hi Ada, thanks for verifying your order WN-1001. Select the item or items this is about, then tell me what went wrong.');

    expect($response->json('conversation.createdAt'))->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/')
        ->and($response->json('order.deliveredAt'))->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/');

    $conversation = Conversation::query()->findOrFail($response->json('conversation.id'));
    expect($conversation->status)->toBe(ConversationStatus::Open);

    expect(AuditEvent::query()->where('type', 'conversation.started')->where('conversation_id', $conversation->id)->exists())->toBeTrue();
});

it('normalises email case and order number case before matching', function (): void {
    verify_customer('  ADA.Okafor@Example.com ', ' wn-1001 ')->assertCreated()
        ->assertJsonPath('order.orderNumber', 'WN-1001');
});

it('reports item refund state on verify', function (): void {
    verify_customer('kemi.ade@example.com', 'WN-1011')
        ->assertCreated()
        ->assertJsonPath('order.items.0.sku', 'HOM-LAMP-DSK')
        ->assertJsonPath('order.items.0.refundStatus', 'approved')
        ->assertJsonPath('order.items.1.refundStatus', null);
});

it('returns undelivered orders with a null deliveredAt', function (): void {
    verify_customer('jide.adeyemi@example.com', 'WN-1010')
        ->assertCreated()
        ->assertJsonPath('order.status', 'processing')
        ->assertJsonPath('order.deliveredAt', null);
});

it('fails generically whatever was wrong', function (string $email, string $orderNumber): void {
    verify_customer($email, $orderNumber)
        ->assertNotFound()
        ->assertExactJson(['error' => [
            'code' => 'VERIFICATION_FAILED',
            'message' => "We couldn't find an order matching those details.",
        ]]);
})->with([
    'unknown email' => ['nobody@example.com', 'WN-1001'],
    'unknown order' => ['ada.okafor@example.com', 'WN-9999'],
    "someone else's order" => ['ada.okafor@example.com', 'WN-1002'],
]);

it('audits a failed verification with a masked email only', function (): void {
    verify_customer('ada.okafor@example.com', 'WN-1002')->assertNotFound();

    $event = AuditEvent::query()->where('type', 'verification.failed')->sole();

    expect($event->data)->toBe(['email' => 'a***@example.com'])
        ->and(Conversation::query()->count())->toBe(0);
});

it('validates the request', function (array $body, array $fields): void {
    $response = $this->postJson('/api/v1/customers/verify', $body)
        ->assertUnprocessable()
        ->assertJsonPath('error.code', 'VALIDATION_FAILED');

    expect(array_column($response->json('error.details'), 'field'))->toBe($fields);
})->with([
    'empty body' => [[], ['email', 'orderNumber']],
    'invalid email' => [['email' => 'not-an-email', 'orderNumber' => 'WN-1001'], ['email']],
    'email too long' => [['email' => str_repeat('a', 250).'@example.com', 'orderNumber' => 'WN-1001'], ['email']],
    'order number with symbols' => [['email' => 'ada.okafor@example.com', 'orderNumber' => 'WN 1001!'], ['orderNumber']],
    'order number too short' => [['email' => 'ada.okafor@example.com', 'orderNumber' => 'WN'], ['orderNumber']],
    'order number too long' => [['email' => 'ada.okafor@example.com', 'orderNumber' => str_repeat('A', 33)], ['orderNumber']],
    'wrong types' => [['email' => ['a@b.c'], 'orderNumber' => 1001], ['email', 'orderNumber']],
]);

describe('conversations per order', function (): void {
    beforeEach(fn () => config()->set('refunds.rate_limits.conversations_per_order_per_day', 3));

    it('allows MAX_CONVERSATIONS_PER_ORDER_PER_DAY conversations per order in 24 hours, then answers 429 and creates nothing', function (): void {
        foreach (range(1, 3) as $ignored) {
            verify_customer('ada.okafor@example.com', 'WN-1001')->assertCreated();
        }

        $messages = Message::query()->count();
        $audits = AuditEvent::query()->count();

        verify_customer('ada.okafor@example.com', 'WN-1001')
            ->assertTooManyRequests()
            ->assertExactJson(['error' => ['code' => 'RATE_LIMITED', 'message' => 'Too many attempts for this order. Please try again later.']]);

        expect(Conversation::query()->count())->toBe(3)
            ->and(Message::query()->count())->toBe($messages)
            ->and(AuditEvent::query()->count())->toBe($audits);

        // Other orders are unaffected.
        verify_customer('chidi.nwosu@example.com', 'WN-1003')->assertCreated();
    });

    it('counts a rolling 24 hours', function (): void {
        $this->travel(-25)->hours();
        foreach (range(1, 3) as $ignored) {
            verify_customer('ada.okafor@example.com', 'WN-1001')->assertCreated();
        }
        $this->travelBack();

        verify_customer('ada.okafor@example.com', 'WN-1001')->assertCreated();
    });

    it('still answers a wrong order number with the generic 404', function (): void {
        foreach (range(1, 3) as $ignored) {
            verify_customer('ada.okafor@example.com', 'WN-1001')->assertCreated();
        }

        verify_customer('ada.okafor@example.com', 'WN-9999')->assertNotFound()->assertJsonPath('error.code', 'VERIFICATION_FAILED');
    });
});
