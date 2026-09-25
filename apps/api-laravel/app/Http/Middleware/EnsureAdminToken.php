<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\AdminUnauthorized;
use Closure;
use Illuminate\Cache\RateLimiter;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every /admin route requires X-Admin-Token to equal ADMIN_TOKEN. Both sides are hashed before the
 * constant-time comparison so the token's length is not leaked either.
 *
 * Failed attempts count per client IP (RATE_LIMIT_ADMIN_FAILURES_PER_MINUTE); once exceeded, every
 * /admin request from that IP answers 429 until the window passes. Successful requests do not count.
 */
final readonly class EnsureAdminToken
{
    private const int WINDOW_SECONDS = 60;

    public function __construct(
        private string $token,
        private int $maxFailuresPerMinute,
        private RateLimiter $limiter,
    ) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $key = 'admin-failures|'.$request->ip();

        if ($this->limiter->tooManyAttempts($key, max(1, $this->maxFailuresPerMinute))) {
            throw new ThrottleRequestsException(
                'Too many failed admin attempts.',
                headers: ['Retry-After' => (string) $this->limiter->availableIn($key)],
            );
        }

        if (! $this->matches($request->header('X-Admin-Token'))) {
            $this->limiter->hit($key, self::WINDOW_SECONDS);

            throw new AdminUnauthorized;
        }

        return $next($request);
    }

    private function matches(mixed $provided): bool
    {
        return $this->token !== ''
            && is_string($provided)
            && hash_equals(hash('sha256', $this->token), hash('sha256', $provided));
    }
}
