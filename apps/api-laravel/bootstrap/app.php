<?php

declare(strict_types=1);

use App\Exceptions\ApiException;
use App\Exceptions\ApiExceptionRenderer;
use App\Http\Middleware\EnsureAdminToken;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: 'api/v1',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(SecurityHeaders::class);

        // Trusted proxies come from TRUSTED_PROXIES (default: none), applied in AppServiceProvider::boot.

        // Reject a bad admin token before route model binding can reveal whether an id exists.
        $middleware->prependToPriorityList(before: SubstituteBindings::class, prepend: EnsureAdminToken::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport(ApiException::class);

        $exceptions->shouldRenderJsonWhen(static fn (): bool => true);

        $exceptions->render(
            static fn (Throwable $exception, Request $request) => (new ApiExceptionRenderer)->render($exception),
        );
    })->create();
