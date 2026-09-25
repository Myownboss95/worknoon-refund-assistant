<?php

declare(strict_types=1);

namespace App\Support;

use App\Enums\ConversationStatus;
use App\Exceptions\ConversationBusy;
use App\Exceptions\ConversationClosed;
use App\Models\Conversation;
use Illuminate\Database\Eloquent\Builder;
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
     * @throws ConversationClosed when the conversation was closed in the meantime
     * @throws ConversationBusy when another turn holds the claim
     */
    public function claim(Conversation $conversation): void
    {
        $claimed = Conversation::query()
            ->whereKey($conversation->id)
            ->where('status', ConversationStatus::Open)
            ->where(static fn (Builder $query) => $query
                ->whereNull('locked_until')
                ->orWhere('locked_until', '<', DB::raw('now()')))
            ->update([
                'locked_until' => DB::raw("now() + interval '".self::LOCK_SECONDS." seconds'"),
                'updated_at' => DB::raw('now()'),
            ]);

        if ($claimed === 1) {
            return;
        }

        $current = Conversation::query()->select(['id', 'status'])->find($conversation->id);

        if ($current === null || $current->isClosed()) {
            throw new ConversationClosed;
        }

        throw new ConversationBusy;
    }

    public function release(Conversation $conversation): void
    {
        Conversation::query()->whereKey($conversation->id)->update(['locked_until' => null]);
    }
}
