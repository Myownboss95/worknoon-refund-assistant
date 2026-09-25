<?php

declare(strict_types=1);

use App\Ai\ClaudeRefundAnalyzer;
use App\Ai\Contracts\RefundAnalyzer;
use App\Ai\LlmCallBudget;
use App\Ai\Prompts\PromptLibrary;
use App\Data\AnalyzerResult;
use App\Data\ComposeInput;
use App\Data\ExtractionInput;
use App\Enums\AiErrorCode;
use App\Enums\DecidedBy;
use App\Enums\RefundStatus;
use App\Exceptions\AnalyzerFailed;
use App\Models\Message;
use App\Models\OrderItem;
use App\Models\RefundRequest;
use App\Models\RefundRequestItem;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => seed_scenarios());

/**
 * An analyzer whose extract and compose steps are scripted per test.
 *
 * @param  Closure(ExtractionInput): AnalyzerResult|null  $extract
 * @param  Closure(ComposeInput): AnalyzerResult|null  $compose
 */
function script_analyzer(?Closure $extract = null, ?Closure $compose = null): object
{
    $real = app(RefundAnalyzer::class);

    $analyzer = new class($real, $extract, $compose) implements RefundAnalyzer
    {
        /** @var list<string> */
        public array $calls = [];

        public ?ExtractionInput $lastExtraction = null;

        public ?ComposeInput $lastCompose = null;

        public function __construct(
            private readonly RefundAnalyzer $real,
            private readonly ?Closure $extract,
            private readonly ?Closure $compose,
        ) {}

        public function extract(ExtractionInput $input): AnalyzerResult
        {
            $this->calls[] = 'extract';
            $this->lastExtraction = $input;

            return $this->extract !== null ? ($this->extract)($input) : $this->real->extract($input);
        }

        public function compose(ComposeInput $input): AnalyzerResult
        {
            $this->calls[] = 'compose';
            $this->lastCompose = $input;

            return $this->compose !== null ? ($this->compose)($input) : $this->real->compose($input);
        }

        public function provider(): string
        {
            return 'anthropic';
        }

        public function model(): string
        {
            return 'claude-test';
        }
    };

    app()->instance(RefundAnalyzer::class, $analyzer);

    return $analyzer;
}

it('falls back to the template when the reply guard rejects the composed reply', function (): void {
    script_analyzer(compose: fn (): AnalyzerResult => AnalyzerResult::composed(
        'Hi Ada, per rule R08 your refund of $5,000.00 has been approved.', 120, 30,
    ));

    $response = request_refund('ada.okafor@example.com', 'WN-1001', ['KIT-BLND-600'], 'It arrived cracked.')
        ->assertOk()
        ->assertJsonPath('decision.status', 'approved')
        ->assertJsonPath('reply.content', "Hi Ada, I'm sorry about the trouble with your ProBlend 600 Blender. Good news: your refund of $89.00 has been approved. It will go back to your original payment method within 5 to 10 business days.");

    refund_detail($response->json('decision.refundRequestId'))
        ->assertJsonPath('flags', ['REPLY_GUARD_FALLBACK'])
        ->assertJsonPath('trace.replyGuard', [
            'passed' => false,
            'violations' => ['LEAKS_INTERNALS', 'WRONG_AMOUNT'],
            'usedTemplate' => true,
        ])
        ->assertJsonPath('trace.ai.provider', 'anthropic')
        ->assertJsonPath('trace.ai.model', 'claude-test')
        ->assertJsonPath('trace.ai.calls.1.inputTokens', 120)
        ->assertJsonPath('trace.ai.calls.1.outputTokens', 30);
});

it('uses a composed reply that passes the guard', function (): void {
    script_analyzer(compose: fn (): AnalyzerResult => AnalyzerResult::composed(
        'Hi Ada, sorry your blender arrived cracked. Your refund of $89.00 has been approved and will reach your original payment method within 5 to 10 business days.',
    ));

    $response = request_refund('ada.okafor@example.com', 'WN-1001', ['KIT-BLND-600'], 'It arrived cracked.')
        ->assertJsonPath('reply.content', 'Hi Ada, sorry your blender arrived cracked. Your refund of $89.00 has been approved and will reach your original payment method within 5 to 10 business days.');

    refund_detail($response->json('decision.refundRequestId'))
        ->assertJsonPath('flags', [])
        ->assertJsonPath('trace.replyGuard', ['passed' => true, 'violations' => [], 'usedTemplate' => false]);
});

it('uses the template and flags COMPOSE_UNAVAILABLE when compose fails twice', function (): void {
    $analyzer = script_analyzer(compose: fn (): AnalyzerResult => throw new AnalyzerFailed(AiErrorCode::ProviderError));

    $response = request_refund('emeka.obi@example.com', 'WN-1005', ['ELE-AERO-14'], 'The screen is cracked.')
        ->assertOk()
        ->assertJsonPath('decision.status', 'escalated')
        ->assertJsonPath('reply.content', "Hi Emeka, thanks for the details about your AeroBook 14 Laptop. I've passed your request to a member of our support team, who will review it and reply within one business day.");

    $detail = refund_detail($response->json('decision.refundRequestId'))
        ->assertJsonPath('flags', ['COMPOSE_UNAVAILABLE'])
        ->assertJsonPath('trace.replyGuard.usedTemplate', true);

    expect($analyzer->calls)->toBe(['extract', 'compose', 'compose'])
        ->and(array_column($detail->json('trace.ai.calls'), 'error'))->toBe([null, 'provider_error', 'provider_error']);
});

it('retries a failed extraction once and continues when the retry succeeds', function (): void {
    $mock = app(RefundAnalyzer::class);
    $attempts = 0;
    $analyzer = script_analyzer(extract: function (ExtractionInput $input) use (&$attempts, $mock): AnalyzerResult {
        if (++$attempts === 1) {
            throw new AnalyzerFailed(AiErrorCode::InvalidOutput);
        }

        return $mock->extract($input);
    });

    $response = request_refund('ada.okafor@example.com', 'WN-1001', ['KIT-BLND-600'], 'It arrived cracked.')
        ->assertJsonPath('decision.status', 'approved');

    $calls = refund_detail($response->json('decision.refundRequestId'))->json('trace.ai.calls');

    expect(array_map(static fn (array $call): array => [$call['step'], $call['attempt'], $call['ok'], $call['error']], $calls))
        ->toBe([
            ['extract', 1, false, 'invalid_output'],
            ['extract', 2, true, null],
            ['compose', 1, true, null],
        ])
        ->and($analyzer->calls)->toBe(['extract', 'extract', 'compose']);
});

it('treats unexpected analyzer exceptions as provider errors and fails safe', function (): void {
    script_analyzer(extract: fn (): AnalyzerResult => throw new RuntimeException('boom'));

    $response = request_refund('ada.okafor@example.com', 'WN-1001', ['KIT-BLND-600'], 'It arrived cracked.')
        ->assertOk()
        ->assertJsonPath('decision.status', 'escalated');

    refund_detail($response->json('decision.refundRequestId'))
        ->assertJsonPath('flags', ['AI_UNAVAILABLE'])
        ->assertJsonPath('trace.ai.calls.0.error', 'provider_error');
});

it('gives the model only trusted order context and every customer message', function (): void {
    $analyzer = script_analyzer();
    [$conversationId, $items] = start_conversation('olivia.chen@example.com', 'WN-1015');

    send_message($conversationId, "I'm not happy with it.", [$items['APP-SWTR-NVY']]);
    send_message($conversationId, 'Wrong colour.', [$items['APP-SWTR-NVY']]);

    $input = $analyzer->lastExtraction;

    expect($input->customerMessages)->toBe(["I'm not happy with it.", 'Wrong colour.'])
        ->and($input->latestMessage)->toBe('Wrong colour.')
        ->and($input->orderContext->toArray())->toBe([
            'orderNumber' => 'WN-1015',
            'status' => 'delivered',
            'daysSinceDelivery' => 10,
            'selectedItems' => [['name' => 'Merino Sweater (Navy)', 'quantity' => 1, 'finalSale' => false]],
        ])
        ->and($analyzer->lastCompose?->toArray())->toBe([
            'outcome' => 'approved',
            'amount' => '$95.00',
            'firstName' => 'Olivia',
            'itemNames' => ['Merino Sweater (Navy)'],
            'customerReasons' => [],
            'summary' => 'Customer received a different item or variant than ordered.',
        ]);
});

it('returns 409 when another request claims the item while the model is working', function (): void {
    $mock = app(RefundAnalyzer::class);

    script_analyzer(compose: function (ComposeInput $input) use ($mock): AnalyzerResult {
        // A concurrent conversation gets the item approved after the facts were read.
        $item = OrderItem::query()->with('order')->where('sku', 'KIT-BLND-600')->sole();
        $refund = RefundRequest::query()->create([
            'conversation_id' => null,
            'customer_id' => $item->order->customer_id,
            'order_id' => $item->order_id,
            'status' => RefundStatus::Approved,
            'decided_by' => DecidedBy::Import,
            'amount_cents' => 8900,
            'currency' => 'USD',
            'decisive_rule_ids' => [],
            'flags' => [],
        ]);
        RefundRequestItem::query()->create(['refund_request_id' => $refund->id, 'order_item_id' => $item->id, 'amount_cents' => 8900]);

        return $mock->compose($input);
    });

    request_refund('ada.okafor@example.com', 'WN-1001', ['KIT-BLND-600'], 'It arrived cracked.')
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'REFUND_ALREADY_EXISTS');

    expect(RefundRequest::query()->whereNotNull('conversation_id')->count())->toBe(0)
        ->and(Message::query()->where('role', 'assistant')->count())->toBe(1); // the greeting only
});

it('fails safe to a human when the hourly provider budget is spent', function (): void {
    config()->set('ai.providers.anthropic.key', 'sk-ant-test');
    config()->set('refunds.llm.max_calls_per_hour', 0);
    Http::preventStrayRequests();
    Http::fake();

    app()->forgetInstance(LlmCallBudget::class);
    app()->instance(RefundAnalyzer::class, new ClaudeRefundAnalyzer(
        app(PromptLibrary::class), 'claude-haiku-4-5', 20, app(LlmCallBudget::class),
    ));

    $response = request_refund('ada.okafor@example.com', 'WN-1001', ['KIT-BLND-600'], 'It arrived cracked.')
        ->assertOk()
        ->assertJsonPath('decision.status', 'escalated');

    Http::assertNothingSent();

    refund_detail($response->json('decision.refundRequestId'))
        ->assertJsonPath('flags', ['AI_UNAVAILABLE', 'COMPOSE_UNAVAILABLE'])
        ->assertJsonPath('trace.replyGuard.usedTemplate', true);

    $calls = RefundRequest::query()->findOrFail($response->json('decision.refundRequestId'))->trace['ai']['calls'];

    expect(array_map(static fn (array $call): array => [$call['step'], $call['ok'], $call['error']], $calls))->toBe([
        ['extract', false, 'provider_error'],
        ['extract', false, 'provider_error'],
        ['compose', false, 'provider_error'],
        ['compose', false, 'provider_error'],
    ]);
});

it('orders selected items by sku, whatever order the customer picked them in', function (): void {
    $analyzer = script_analyzer();
    [$conversationId, $items] = start_conversation('ngozi.eze@example.com', 'WN-1014');

    send_message(
        $conversationId,
        'Both the side table and the lamp arrived damaged. The table leg is split.',
        [$items['HOM-TBL-OAK'], $items['HOM-LAMP-TBL']],
    )->assertOk();

    $bySku = OrderItem::query()->whereIn('sku', ['HOM-LAMP-TBL', 'HOM-TBL-OAK'])->orderBy('sku')->pluck('name')->all();

    expect(array_column($analyzer->lastExtraction->orderContext->toArray()['selectedItems'], 'name'))->toBe($bySku)
        ->and($analyzer->lastCompose?->itemNames)->toBe($bySku);
});
