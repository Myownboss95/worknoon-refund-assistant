<?php

declare(strict_types=1);

use App\Models\AuditEvent;
use App\Models\Conversation;
use App\Models\Customer;
use App\Models\RefundRequest;

beforeEach(fn () => seed_scenarios());

/**
 * Run scenario $id end to end and return the refund request id.
 */
function decide_scenario(int $id): string
{
    $scenario = scenario($id);
    [$conversationId, $items] = start_conversation($scenario['email'], $scenario['orderNumber']);
    $itemIds = array_map(static fn (string $sku): string => $items[$sku], $scenario['skus']);

    $response = null;

    foreach ($scenario['messages'] as $text) {
        $response = send_message($conversationId, $text, $itemIds)->assertOk();
    }

    return (string) $response?->json('decision.refundRequestId');
}

describe('authentication', function (): void {
    it('requires the admin token on every admin route', function (string $method, string $uri): void {
        foreach ([[], ['X-Admin-Token' => 'wrong'], ['X-Admin-Token' => '']] as $headers) {
            $this->json($method, $uri, [], $headers)
                ->assertUnauthorized()
                ->assertExactJson(['error' => ['code' => 'ADMIN_UNAUTHORIZED', 'message' => 'A valid admin token is required.']]);
        }
    })->with([
        'list' => ['GET', '/api/v1/admin/refund-requests'],
        'detail' => ['GET', '/api/v1/admin/refund-requests/00000000-0000-4000-8000-000000000000'],
        'review' => ['POST', '/api/v1/admin/refund-requests/00000000-0000-4000-8000-000000000000/review'],
        'stats' => ['GET', '/api/v1/admin/stats'],
        'reset' => ['POST', '/api/v1/admin/demo/reset'],
    ]);

    it('does not reset anything without the token', function (): void {
        $this->postJson('/api/v1/admin/demo/reset')->assertUnauthorized();

        expect(Customer::query()->count())->toBe(15);
    });
});

describe('list', function (): void {
    it('lists assistant-created requests only, newest first', function (): void {
        $this->travel(-2)->minutes();
        $first = decide_scenario(1);
        $this->travel(1)->minutes();
        $second = decide_scenario(5);
        $this->travelBack();
        $third = decide_scenario(3);

        $response = $this->getJson('/api/v1/admin/refund-requests', admin_headers())
            ->assertOk()
            ->assertExactJsonStructure([
                'data' => ['*' => [
                    'id', 'status', 'decidedBy', 'customer' => ['name', 'email'], 'orderNumber', 'amountCents',
                    'currency', 'reasonCategory', 'flags', 'decisiveRuleIds', 'createdAt',
                ]],
                'meta' => ['page', 'perPage', 'total', 'lastPage'],
            ])
            ->assertJsonPath('meta', ['page' => 1, 'perPage' => 20, 'total' => 3, 'lastPage' => 1]);

        expect(array_column($response->json('data'), 'id'))->toBe([$third, $second, $first])
            ->and($response->json('data.0'))->toMatchArray([
                'status' => 'denied',
                'decidedBy' => 'policy',
                'customer' => ['name' => 'Chidi Nwosu', 'email' => 'chidi.nwosu@example.com'],
                'orderNumber' => 'WN-1003',
                'amountCents' => 14000,
                'currency' => 'USD',
                'reasonCategory' => 'changed_mind',
                'flags' => [],
                'decisiveRuleIds' => ['R04'],
            ]);
    });

    it('filters by status', function (): void {
        decide_scenario(1);
        $escalated = decide_scenario(5);
        decide_scenario(3);

        $this->getJson('/api/v1/admin/refund-requests?status=escalated', admin_headers())
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $escalated)
            ->assertJsonPath('meta.total', 1);
    });

    it('paginates', function (): void {
        foreach ([1, 2, 3, 4, 5] as $id) {
            decide_scenario($id);
        }

        $this->getJson('/api/v1/admin/refund-requests?perPage=2&page=3', admin_headers())
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('meta', ['page' => 3, 'perPage' => 2, 'total' => 5, 'lastPage' => 3]);

        $this->getJson('/api/v1/admin/refund-requests?perPage=2&page=9', admin_headers())
            ->assertOk()
            ->assertJsonCount(0, 'data');
    });

    it('reports lastPage 1 when empty', function (): void {
        $this->getJson('/api/v1/admin/refund-requests', admin_headers())
            ->assertOk()
            ->assertExactJson(['data' => [], 'meta' => ['page' => 1, 'perPage' => 20, 'total' => 0, 'lastPage' => 1]]);
    });

    it('validates the query', function (string $query, string $field): void {
        $this->getJson("/api/v1/admin/refund-requests?{$query}", admin_headers())
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonPath('error.details.0.field', $field);
    })->with([
        ['status=pending', 'status'],
        ['page=0', 'page'],
        ['page=abc', 'page'],
        ['perPage=101', 'perPage'],
        ['perPage=0', 'perPage'],
    ]);
});

describe('detail', function (): void {
    it('returns the full decision trace', function (): void {
        $id = decide_scenario(9);

        refund_detail($id)
            ->assertExactJsonStructure([
                'id', 'status', 'decidedBy', 'customer' => ['name', 'email'], 'orderNumber', 'amountCents', 'currency',
                'reasonCategory', 'flags', 'decisiveRuleIds', 'createdAt',
                'items' => ['*' => ['orderItemId', 'sku', 'name', 'quantity', 'amountCents', 'finalSale']],
                'conversation' => ['id', 'messages' => ['*' => ['id', 'role', 'content', 'itemIds', 'createdAt']]],
                'trace' => [
                    'policyVersion', 'evaluatedAt',
                    'facts' => ['orderStatus', 'daysSinceDelivery', 'amountCents', 'recentApprovedRefunds', 'finalSaleItemIds', 'alreadyRefundedItemIds'],
                    'rules' => ['*' => ['ruleId', 'outcome', 'reason']],
                    'extraction' => ['reasonCategory', 'itemsMentioned', 'claimsConflict', 'injectionSuspected', 'summary', 'confidence'],
                    'heuristicMatches', 'flags', 'clarificationTurns',
                    'ai' => [
                        'provider', 'model', 'promptVersions' => ['extract', 'compose'],
                        'calls' => ['*' => ['step', 'attempt', 'ok', 'latencyMs', 'inputTokens', 'outputTokens', 'error']],
                    ],
                    'replyGuard' => ['passed', 'violations', 'usedTemplate'],
                ],
                'review',
                'auditEvents' => ['*' => ['id', 'type', 'actor', 'data', 'createdAt']],
            ])
            ->assertJsonPath('status', 'escalated')
            ->assertJsonPath('flags', ['CLAIM_CONFLICT'])
            ->assertJsonPath('items.0.sku', 'ELE-HDPH-NC')
            ->assertJsonPath('items.0.amountCents', 19900)
            ->assertJsonPath('review', null)
            ->assertJsonPath('trace.rules.6', ['ruleId' => 'R07', 'outcome' => 'escalate', 'reason' => 'Suspicious signals: CLAIM_CONFLICT'])
            ->assertJsonPath('trace.rules.9.outcome', 'escalate')
            ->assertJsonPath('auditEvents.0.type', 'conversation.started')
            ->assertJsonPath('auditEvents.1.type', 'refund.decided')
            ->assertJsonPath('conversation.messages.1.role', 'customer');
    });

    it('returns 404 for unknown, malformed and imported ids', function (): void {
        $imported = RefundRequest::query()->whereNull('conversation_id')->firstOrFail();

        foreach (['00000000-0000-4000-8000-000000000000', 'abc', $imported->id] as $id) {
            $this->getJson("/api/v1/admin/refund-requests/{$id}", admin_headers())
                ->assertNotFound()
                ->assertJsonPath('error.code', 'NOT_FOUND');
        }
    });
});

describe('review', function (): void {
    it('approves an escalated request', function (): void {
        $id = decide_scenario(5);

        $response = $this->postJson("/api/v1/admin/refund-requests/{$id}/review", [
            'decision' => 'approve',
            'note' => 'Photos confirm the cracked screen.',
        ], admin_headers())
            ->assertOk()
            ->assertJsonPath('status', 'approved')
            ->assertJsonPath('decidedBy', 'human')
            ->assertJsonPath('decisiveRuleIds', ['R06'])
            ->assertJsonPath('review.decision', 'approve')
            ->assertJsonPath('review.note', 'Photos confirm the cracked screen.')
            ->assertJsonPath('review.reviewer', 'admin')
            ->assertJsonPath('conversation.messages.3.role', 'system')
            ->assertJsonPath('conversation.messages.3.content', 'Update from our support team: your refund of $1,299.00 has been approved. It will go back to your original payment method within 5 to 10 business days. Note from the reviewer: Photos confirm the cracked screen.');

        expect(array_column($response->json('auditEvents'), 'type'))
            ->toBe(['conversation.started', 'refund.decided', 'refund.reviewed'])
            ->and($response->json('auditEvents.2'))->toMatchArray([
                'actor' => 'admin',
                'data' => ['decision' => 'approve', 'note' => 'Photos confirm the cracked screen.'],
            ]);

        $conversationId = $response->json('conversation.id');

        $this->getJson("/api/v1/conversations/{$conversationId}")
            ->assertJsonPath('decision.status', 'approved')
            ->assertJsonPath('decision.decidedBy', 'human')
            ->assertJsonPath('decision.customerReason', 'Your refund of $1,299.00 has been approved.')
            ->assertJsonPath('order.items.0.refundStatus', 'approved');
    });

    it('denies an escalated request', function (): void {
        $id = decide_scenario(9);

        $this->postJson("/api/v1/admin/refund-requests/{$id}/review", [
            'decision' => 'deny',
            'note' => 'Carrier confirms delivery with a signature.',
        ], admin_headers())
            ->assertOk()
            ->assertJsonPath('status', 'denied')
            ->assertJsonPath('decidedBy', 'human')
            ->assertJsonPath('conversation.messages.3.content', "Update from our support team: after reviewing your request, we're unable to offer a refund. Note from the reviewer: Carrier confirms delivery with a signature.");

        $conversation = Conversation::query()->whereHas('refundRequest', fn ($q) => $q->whereKey($id))->sole();

        $this->getJson("/api/v1/conversations/{$conversation->id}")
            ->assertJsonPath('decision.status', 'denied')
            ->assertJsonPath('order.items.0.refundStatus', null);
    });

    it('refuses to review a request that is not escalated', function (): void {
        $id = decide_scenario(1);

        $this->postJson("/api/v1/admin/refund-requests/{$id}/review", ['decision' => 'deny', 'note' => 'Changed my mind.'], admin_headers())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'REFUND_NOT_REVIEWABLE');
    });

    it('can only review once', function (): void {
        $id = decide_scenario(13);
        $body = ['decision' => 'approve', 'note' => 'Merchant fault.'];

        $this->postJson("/api/v1/admin/refund-requests/{$id}/review", $body, admin_headers())->assertOk();
        $this->postJson("/api/v1/admin/refund-requests/{$id}/review", $body, admin_headers())->assertStatus(409);

        expect(AuditEvent::query()->where('type', 'refund.reviewed')->count())->toBe(1);
    });

    it('validates the review', function (array $body, array $fields): void {
        $id = decide_scenario(5);

        $response = $this->postJson("/api/v1/admin/refund-requests/{$id}/review", $body, admin_headers())
            ->assertUnprocessable();

        expect(array_column($response->json('error.details'), 'field'))->toBe($fields);
    })->with([
        'empty' => [[], ['decision', 'note']],
        'unknown decision' => [['decision' => 'maybe', 'note' => 'Hmm, not sure.'], ['decision']],
        'note too short' => [['decision' => 'approve', 'note' => 'ok'], ['note']],
        'note too long' => [['decision' => 'approve', 'note' => str_repeat('a', 1001)], ['note']],
    ]);

    it('returns 404 for an unknown request', function (): void {
        $this->postJson('/api/v1/admin/refund-requests/00000000-0000-4000-8000-000000000000/review', [
            'decision' => 'approve', 'note' => 'Looks fine.',
        ], admin_headers())->assertNotFound();
    });
});

describe('stats', function (): void {
    it('is all zeros before any decision', function (): void {
        $this->getJson('/api/v1/admin/stats', admin_headers())
            ->assertOk()
            ->assertExactJson([
                'total' => 0,
                'byStatus' => ['approved' => 0, 'denied' => 0, 'escalated' => 0],
                'escalatedTotal' => 0,
                'humanReviewed' => 0,
                'escalationRate' => 0,
                'autoResolutionRate' => 0,
            ]);
    });

    it('counts assistant decisions and human reviews', function (): void {
        decide_scenario(1);                 // approved
        decide_scenario(3);                 // denied
        decide_scenario(6);                 // approved
        $reviewed = decide_scenario(5);     // escalated, then approved by a human
        decide_scenario(9);                 // escalated
        decide_scenario(13);                // escalated

        $this->postJson("/api/v1/admin/refund-requests/{$reviewed}/review", ['decision' => 'approve', 'note' => 'Verified.'], admin_headers())->assertOk();

        $this->getJson('/api/v1/admin/stats', admin_headers())
            ->assertOk()
            ->assertExactJson([
                'total' => 6,
                'byStatus' => ['approved' => 3, 'denied' => 1, 'escalated' => 2],
                'escalatedTotal' => 3,
                'humanReviewed' => 1,
                'escalationRate' => 0.5,
                'autoResolutionRate' => 0.5,
            ]);
    });

    it('rounds rates to four decimals', function (): void {
        decide_scenario(1);
        decide_scenario(3);
        decide_scenario(5);

        $this->getJson('/api/v1/admin/stats', admin_headers())
            ->assertJsonPath('escalationRate', 0.3333)
            ->assertJsonPath('autoResolutionRate', 0.6667);
    });
});

describe('reset', function (): void {
    it('truncates everything and re-seeds from the scenarios', function (): void {
        decide_scenario(1);

        $this->postJson('/api/v1/admin/demo/reset', [], admin_headers())
            ->assertOk()
            ->assertExactJson(['reset' => true, 'customers' => 15, 'orders' => 19]);

        expect(Conversation::query()->count())->toBe(0)
            ->and(AuditEvent::query()->count())->toBe(0)
            ->and(RefundRequest::query()->count())->toBe(5)
            ->and(RefundRequest::query()->whereNotNull('conversation_id')->count())->toBe(0);

        // The scenarios work again after a reset.
        expect(decide_scenario(1))->not->toBeEmpty();
    });
});
