<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\ConversationStatus;
use App\Exceptions\ConversationBusy;
use App\Exceptions\ConversationClosed;
use App\Models\Conversation;
use Illuminate\Support\Facades\DB;

/**
 * One customer turn at a time per conversation (docs/pipeline.md, Hardening). A turn claims the
 * row with a single conditional UPDATE, so two concurrent requests can never both win; the claim
 * expires on its own after LOCK_SECONDS in case the worker dies mid-turn.
 */
final class ConversationTurnLock
{
    public const int LOCK_SECONDS = 90;

    /**
     * Claims the conversation for one turn and returns the claim token (the stored expiry), which
     * release() needs so it can only clear its own claim. clock_timestamp() rather than now(), so
     * two claims inside one transaction still get distinct tokens.
     *
     * @throws ConversationClosed when the conversation was closed in the meantime
     * @throws ConversationBusy when another turn holds the claim
     */
    public function claim(Conversation $conversation): string
    {
        /** @var object{locked_until: string}|null $claimed */
        $claimed = DB::selectOne(
            'UPDATE conversations
                SET locked_until = clock_timestamp() + make_interval(secs => ?), updated_at = now()
              WHERE id = ? AND status = ? AND (locked_until IS NULL OR locked_until < clock_timestamp())
          RETURNING locked_until',
            [self::LOCK_SECONDS, $conversation->id, ConversationStatus::Open->value],
        );

        if ($claimed !== null) {
            return $claimed->locked_until;
        }

        $current = Conversation::query()->select(['id', 'status'])->find($conversation->id);

        if ($current === null || $current->isClosed()) {
            throw new ConversationClosed;
        }

        throw new ConversationBusy;
    }

    /**
     * Clears the claim only if it is still ours. A turn that stalled past LOCK_SECONDS may have lost
     * the conversation to a newer turn, and must not release that turn's claim.
     */
    public function release(Conversation $conversation, string $claim): void
    {
        Conversation::query()
            ->whereKey($conversation->id)
            ->where('locked_until', $claim)
            ->update(['locked_until' => null]);
    }
}
