<?php

declare(strict_types=1);

use App\Ai\ClaudeRefundAnalyzer;
use App\Ai\Contracts\RefundAnalyzer;
use App\Ai\MockRefundAnalyzer;
use App\Models\Customer;
use App\Models\Order;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

describe('health', function (): void {
    it('reports ok with the backend, AI mode and policy version', function (): void {
        $response = $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('backend', 'laravel')
            ->assertJsonPath('database', 'ok')
            ->assertJsonPath('ai', ['provider' => 'mock', 'model' => 'mock'])
            ->assertJsonPath('policyVersion', '1.0');

        expect($response->json('time'))->toMatch('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/');
    });

    it('reports degraded with 503 when the database is down', function (): void {
        config()->set('database.connections.broken', [...config('database.connections.pgsql'), 'port' => 1]);
        config()->set('database.default', 'broken');

        try {
            $this->getJson('/api/v1/health')
                ->assertStatus(503)
                ->assertJsonPath('status', 'degraded')
                ->assertJsonPath('database', 'down')
                ->assertJsonPath('backend', 'laravel');
        } finally {
            config()->set('database.default', 'pgsql');
        }
    });
});

it('serves the policy document and config', function (): void {
    $response = $this->getJson('/api/v1/policy')
        ->assertOk()
        ->assertJsonPath('version', '1.0')
        ->assertJsonPath('config.refundWindowDays', 30)
        ->assertJsonPath('config.humanReviewThresholdCents', 50000)
        ->assertJsonPath('config.minAiConfidence', 0.6);

    expect($response->json('markdown'))->toStartWith('# Refund Policy v1.0')
        ->and($response->json('config'))->toBe(array_filter(
            contract_json('policy.config.json'),
            static fn (string $key): bool => ! str_starts_with($key, '$'),
            ARRAY_FILTER_USE_KEY,
        ));
});

describe('error envelope', function (): void {
    it('returns NOT_FOUND for unknown routes and unsupported methods', function (string $method, string $uri): void {
        $this->json($method, $uri)
            ->assertNotFound()
            ->assertExactJson(['error' => ['code' => 'NOT_FOUND', 'message' => 'The requested resource was not found.']]);
    })->with([
        ['GET', '/api/v1/nope'],
        ['GET', '/'],
        ['GET', '/api/v2/health'],
        ['DELETE', '/api/v1/health'],
        ['GET', '/api/v1/customers/verify'],
    ]);

    it('hides unhandled exceptions behind INTERNAL_ERROR', function (): void {
        Route::get('/api/v1/_boom', static fn () => throw new RuntimeException('secret database detail'));

        $this->getJson('/api/v1/_boom')
            ->assertStatus(500)
            ->assertExactJson(['error' => [
                'code' => 'INTERNAL_ERROR',
                'message' => 'Something went wrong on our side. Please try again.',
            ]]);
    });

    it('rate limits verification per IP', function (): void {
        seed_scenarios();
        config()->set('refunds.rate_limits.verify_per_minute', 2);

        verify_customer('ada.okafor@example.com', 'WN-1001')->assertCreated();
        verify_customer('ada.okafor@example.com', 'WN-1001')->assertCreated();

        verify_customer('ada.okafor@example.com', 'WN-1001')
            ->assertStatus(429)
            ->assertHeader('Retry-After')
            ->assertExactJson(['error' => [
                'code' => 'RATE_LIMITED',
                'message' => 'Too many requests. Please wait a moment and try again.',
            ]]);
    });

    it('rate limits messages per IP', function (): void {
        seed_scenarios();
        config()->set('refunds.rate_limits.messages_per_minute', 1);
        [$conversationId, $items] = start_conversation('olivia.chen@example.com', 'WN-1015');

        send_message($conversationId, "I'm not happy with it.", [$items['APP-SWTR-NVY']])->assertOk();
        send_message($conversationId, 'Wrong colour.', [$items['APP-SWTR-NVY']])
            ->assertStatus(429)
            ->assertJsonPath('error.code', 'RATE_LIMITED');
    });
});

describe('http hardening', function (): void {
    it('sends security headers', function (): void {
        $this->getJson('/api/v1/health')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer');
    });

    it('allows CORS only from the configured origin', function (): void {
        $preflight = fn (string $origin) => $this->call('OPTIONS', '/api/v1/customers/verify', server: [
            'HTTP_ORIGIN' => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type',
        ]);

        $preflight('http://localhost:8080')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:8080');

        // Never echoes another origin back, so browsers refuse the cross-origin call.
        expect($preflight('https://evil.example')->headers->get('Access-Control-Allow-Origin'))
            ->not->toBe('https://evil.example');
    });
});

describe('AI logging', function (): void {
    it('writes one structured line per AI call without message text or emails', function (): void {
        seed_scenarios();
        Log::spy();

        request_refund('ada.okafor@example.com', 'WN-1001', ['KIT-BLND-600'], 'My blender arrived with a cracked jug.')->assertOk();

        $lines = [];
        Log::shouldHaveReceived('info')
            ->withArgs(function (string $message, array $context) use (&$lines): bool {
                if ($message === 'ai.call') {
                    $lines[] = $context;
                }

                return true;
            });

        expect($lines)->toHaveCount(2)
            ->and(array_keys($lines[0]))->toBe(['step', 'provider', 'model', 'promptVersion', 'attempt', 'latencyMs', 'inputTokens', 'outputTokens', 'ok', 'error'])
            ->and($lines[0])->toMatchArray(['step' => 'extract', 'provider' => 'mock', 'promptVersion' => 'extract.v1', 'ok' => true])
            ->and($lines[1])->toMatchArray(['step' => 'compose', 'promptVersion' => 'compose.v1']);

        $logged = json_encode($lines, JSON_THROW_ON_ERROR);
        expect($logged)->not->toContain('cracked')->not->toContain('ada.okafor');
    });
});

describe('configuration', function (): void {
    it('uses the mock analyzer unless anthropic is selected with a key', function (string $provider, string $key, string $expected): void {
        $saved = [getenv('LLM_PROVIDER'), getenv('ANTHROPIC_API_KEY')];

        try {
            foreach (['LLM_PROVIDER' => $provider, 'ANTHROPIC_API_KEY' => $key] as $name => $value) {
                putenv("{$name}={$value}");
                $_ENV[$name] = $_SERVER[$name] = $value;
            }

            expect((require config_path('refunds.php'))['llm']['provider'])->toBe($expected);
        } finally {
            foreach (['LLM_PROVIDER' => $saved[0], 'ANTHROPIC_API_KEY' => $saved[1]] as $name => $value) {
                putenv("{$name}=".($value === false ? '' : $value));
                $_ENV[$name] = $_SERVER[$name] = $value === false ? '' : $value;
            }
        }
    })->with([
        'mock' => ['mock', '', 'mock'],
        'anthropic without a key' => ['anthropic', '', 'mock'],
        'anthropic with a key' => ['anthropic', 'sk-test', 'anthropic'],
        'unknown provider' => ['openai', 'sk-test', 'mock'],
    ]);

    it('binds the analyzer that the configuration selects', function (): void {
        expect(app(RefundAnalyzer::class))->toBeInstanceOf(MockRefundAnalyzer::class);

        config()->set('refunds.llm.provider', 'anthropic');
        app()->forgetInstance(RefundAnalyzer::class);

        $analyzer = app(RefundAnalyzer::class);

        expect($analyzer)->toBeInstanceOf(ClaudeRefundAnalyzer::class)
            ->and($analyzer->provider())->toBe('anthropic')
            ->and($analyzer->model())->toBe('claude-haiku-4-5');
    });
});

it('seeds once and is idempotent', function (): void {
    $this->artisan('db:seed', ['--force' => true])->assertSuccessful();
    $this->artisan('db:seed', ['--force' => true])->assertSuccessful();

    expect(Customer::query()->count())->toBe(15)
        ->and(Order::query()->count())->toBe(19);

    $halima = Customer::query()->where('email', 'halima.yusuf@example.com')->sole();
    $dana = Order::query()->where('order_number', 'WN-1004')->sole();

    expect($halima->refundRequests()->count())->toBe(4)
        ->and((int) round($dana->delivered_at?->diffInDays(now()) ?? 0))->toBe(60);
});
