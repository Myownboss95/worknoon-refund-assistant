<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Exceptions\ConversationClosed;
use App\Models\Conversation;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A closed conversation answers 409 before the message body is validated (pipeline step 1).
 * The pipeline re-checks under a row lock when it persists.
 */
final class EnsureConversationOpen
{
    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $conversation = $request->route('conversation');

        if ($conversation instanceof Conversation && $conversation->isClosed()) {
            throw new ConversationClosed;
        }

        return $next($request);
    }
}
