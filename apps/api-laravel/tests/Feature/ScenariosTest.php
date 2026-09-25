<?php

declare(strict_types=1);

/*
| Every scenario in contracts/scenarios.json, end to end in mock mode, asserting exactly what the
| contract suite asserts: status, decisive rules, amount, flags and number of clarifications.
*/

beforeEach(fn () => seed_scenarios());

/**
 * @return array<string, array{array<string, mixed>}>
 */
function scenarios_dataset(): array
{
    $dataset = [];

    foreach (contract_json('scenarios.json')['scenarios'] as $scenario) {
        $dataset["#{$scenario['id']} {$scenario['title']}"] = [$scenario];
    }

    return $dataset;
}

it('decides the scenario as the contract expects', function (array $scenario): void {
    [$conversationId, $items] = start_conversation($scenario['email'], $scenario['orderNumber']);
    $itemIds = array_map(static fn (string $sku): string => $items[$sku], $scenario['skus']);
    $expected = $scenario['expected'];

    $messages = $scenario['messages'];
    $last = array_pop($messages);

    foreach ($messages as $text) {
        send_message($conversationId, $text, $itemIds)
            ->assertOk()
            ->assertJsonPath('decision', null)
            ->assertJsonPath('conversation.status', 'open');
    }

    $response = send_message($conversationId, $last, $itemIds)
        ->assertOk()
        ->assertJsonPath('conversation.status', 'closed')
        ->assertJsonPath('conversation.clarificationTurns', $expected['clarifications'])
        ->assertJsonPath('decision.status', $expected['status'])
        ->assertJsonPath('decision.decidedBy', 'policy')
        ->assertJsonPath('decision.decisiveRuleIds', $expected['decisiveRuleIds'])
        ->assertJsonPath('decision.amountCents', $expected['amountCents'])
        ->assertJsonPath('decision.currency', 'USD');

    $detail = refund_detail($response->json('decision.refundRequestId'))
        ->assertJsonPath('flags', $expected['flags'])
        ->assertJsonPath('trace.flags', $expected['flags'])
        ->assertJsonPath('trace.clarificationTurns', $expected['clarifications']);

    // The mock composer's replies always pass the guard.
    $detail->assertJsonPath('trace.replyGuard', ['passed' => true, 'violations' => [], 'usedTemplate' => false]);

    // The customer never sees flags or internal reasons.
    expect($response->json('decision'))->not->toHaveKey('flags')
        ->and($response->json('reply.content'))->not->toMatch('/\bR(0[1-9]|10)\b/');
})->with(scenarios_dataset());

it('gives each denial its customer-safe reason', function (int $scenarioId, string $reason): void {
    $scenario = scenario($scenarioId);

    request_refund($scenario['email'], $scenario['orderNumber'], $scenario['skus'], $scenario['messages'][0])
        ->assertOk()
        ->assertJsonPath('decision.customerReason', $reason)
        ->assertJsonPath('reply.content', fn (string $content): bool => str_ends_with($content, $reason));
})->with([
    'final sale' => [3, "Final sale items can't be refunded."],
    'outside the window' => [4, 'It was delivered more than 30 days ago, which is outside our refund window.'],
    'change of mind too late' => [7, 'Change-of-mind refunds are available for 14 days after delivery, and that window has passed.'],
    'not delivered' => [10, "This order hasn't been delivered yet, so it can't be refunded. You can cancel it instead from your order page before it ships."],
    'already refunded' => [11, 'A refund for this item has already been issued or is being reviewed.'],
]);
