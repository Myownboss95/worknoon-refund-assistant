<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\AdminUnauthorized;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every /admin route requires X-Admin-Token to equal ADMIN_TOKEN (constant-time comparison).
 */
final readonly class EnsureAdminToken
{
    public function __construct(private string $token) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $provided = $request->header('X-Admin-Token');

        if ($this->token === '' || ! is_string($provided) || ! hash_equals($this->token, $provided)) {
            throw new AdminUnauthorized;
        }

        return $next($request);
    }
}
