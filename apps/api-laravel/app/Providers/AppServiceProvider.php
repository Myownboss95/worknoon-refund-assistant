<?php

declare(strict_types=1);

namespace App\Providers;

use App\Actions\VerifyCustomer;
use App\Ai\AiCallRunner;
use App\Ai\ClaudeRefundAnalyzer;
use App\Ai\Contracts\RefundAnalyzer;
use App\Ai\Guards\InjectionDetector;
use App\Ai\Guards\ReplyGuard;
use App\Ai\LlmCallBudget;
use App\Ai\MockRefundAnalyzer;
use App\Ai\Prompts\PromptLibrary;
use App\Domain\Refunds\Policy\PolicyConfig;
use App\Domain\Refunds\Policy\PolicyEngine;
use App\Domain\Refunds\Support\TemplateRenderer;
use App\Http\Middleware\EnsureAdminToken;
use App\Models\RefundRequest;
use App\Support\AdminTokenCheck;
use App\Support\ContractFiles;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiter as CacheRateLimiter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Config\Repository;
use Illuminate\Contracts\Foundation\Application;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Psr\Log\LoggerInterface;

final class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(ContractFiles::class, static fn (Application $app): ContractFiles => new ContractFiles(
            self::config($app)->string('refunds.contracts_path'),
        ));

        $this->app->singleton(PolicyConfig::class, static function (Application $app): PolicyConfig {
            /** @var array<string, mixed> $policy */
            $policy = self::config($app)->array('refunds.policy');

            return PolicyConfig::fromArray($policy);
        });

        $this->app->singleton(PolicyEngine::class, static fn (): PolicyEngine => PolicyEngine::default());

        $this->app->singleton(TemplateRenderer::class, static fn (Application $app): TemplateRenderer => new TemplateRenderer(
            array_filter(
                $app->make(ContractFiles::class)->json('reply-templates.json'),
                static fn (mixed $template, string $key): bool => is_string($template) && ! str_starts_with($key, '$'),
                ARRAY_FILTER_USE_BOTH,
            ),
        ));

        $this->app->singleton(PromptLibrary::class, static fn (Application $app): PromptLibrary => PromptLibrary::fromContracts(
            $app->make(ContractFiles::class),
        ));

        $this->app->singleton(InjectionDetector::class, static function (Application $app): InjectionDetector {
            /** @var list<array{id: string, pattern: string}> $patterns */
            $patterns = $app->make(ContractFiles::class)->json('injection-patterns.json')['patterns'] ?? [];

            return InjectionDetector::fromDefinitions($patterns);
        });

        $this->app->singleton(ReplyGuard::class, static fn (Application $app): ReplyGuard => ReplyGuard::fromConfig(
            $app->make(ContractFiles::class)->json('reply-guard.json'),
        ));

        $this->app->singleton(RefundAnalyzer::class, static function (Application $app): RefundAnalyzer {
            $config = self::config($app);

            if ($config->string('refunds.llm.provider') === 'anthropic') {
                return new ClaudeRefundAnalyzer(
                    $app->make(PromptLibrary::class),
                    $config->string('refunds.llm.model'),
                    $config->integer('refunds.llm.timeout_seconds'),
                    $app->make(LlmCallBudget::class),
                );
            }

            return MockRefundAnalyzer::fromFixtures(
                $app->make(ContractFiles::class)->json('mock-llm-fixtures.json'),
                $app->make(TemplateRenderer::class),
            );
        });

        $this->app->singleton(AiCallRunner::class, static fn (Application $app): AiCallRunner => new AiCallRunner(
            $app->make(RefundAnalyzer::class),
            $app->make(LoggerInterface::class),
            self::config($app)->integer('refunds.llm.max_attempts'),
        ));

        $this->app->singleton(LlmCallBudget::class, static fn (Application $app): LlmCallBudget => new LlmCallBudget(
            $app->make(CacheRateLimiter::class),
            $app->make(LoggerInterface::class),
            self::config($app)->integer('refunds.llm.max_calls_per_hour'),
        ));

        $this->app->singleton(AdminTokenCheck::class, static fn (Application $app): AdminTokenCheck => new AdminTokenCheck(
            self::config($app)->string('refunds.admin_token'),
            self::config($app)->boolean('refunds.demo_mode'),
            $app->isProduction(),
        ));

        $this->app->when(EnsureAdminToken::class)
            ->needs('$token')
            ->giveConfig('refunds.admin_token');

        $this->app->when(EnsureAdminToken::class)
            ->needs('$maxFailuresPerMinute')
            ->giveConfig('refunds.rate_limits.admin_failures_per_minute');

        $this->app->when(VerifyCustomer::class)
            ->needs('$maxConversationsPerOrderPerDay')
            ->giveConfig('refunds.rate_limits.conversations_per_order_per_day');
    }

    public function boot(): void
    {
        Model::shouldBeStrict(! $this->app->isProduction());
        Date::use(CarbonImmutable::class);
        JsonResource::withoutWrapping();

        $config = self::config($this->app);

        // Refuse to boot in production with a weak admin token unless DEMO_MODE is on.
        $this->app->make(AdminTokenCheck::class)->enforce();

        // Only these proxies may set X-Forwarded-For; with none configured the socket address is the client.
        TrustProxies::at($config->array('refunds.trusted_proxies'));

        RateLimiter::for('verify', static fn (Request $request): Limit => Limit::perMinute(
            max(1, $config->integer('refunds.rate_limits.verify_per_minute')),
        )->by('verify|'.$request->ip()));

        RateLimiter::for('messages', static fn (Request $request): Limit => Limit::perMinute(
            max(1, $config->integer('refunds.rate_limits.messages_per_minute')),
        )->by('messages|'.$request->ip()));

        // Imported history has no conversation or trace, so it is not addressable by the admin API.
        Route::bind('refundRequest', static fn (string $id): RefundRequest => RefundRequest::query()
            ->assistantCreated()
            ->findOrFail($id));
    }

    private static function config(Application $app): Repository
    {
        return $app->make(Repository::class);
    }
}
