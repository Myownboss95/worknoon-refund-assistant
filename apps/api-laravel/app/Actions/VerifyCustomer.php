<?php

declare(strict_types=1);

namespace App\Actions;

use App\Data\VerifyCustomerData;
use App\Domain\Refunds\Support\EmailMask;
use App\Domain\Refunds\Support\Names;
use App\Domain\Refunds\Support\TemplateRenderer;
use App\Enums\ConversationStatus;
use App\Enums\MessageRole;
use App\Exceptions\TooManyConversations;
use App\Exceptions\VerificationFailed;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Support\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * POST /customers/verify: match email + order number, then start a conversation with a greeting.
 * At most MAX_CONVERSATIONS_PER_ORDER_PER_DAY conversations per order in a rolling 24 hours.
 */
final readonly class VerifyCustomer
{
    public function __construct(
        private TemplateRenderer $templates,
        private AuditLog $audit,
        private LoadConversation $loadConversation,
        private int $maxConversationsPerOrderPerDay,
    ) {}

    public function __invoke(VerifyCustomerData $data): Conversation
    {
        $order = Order::query()
            ->with('customer')
            ->where('order_number', $data->orderNumber)
            ->whereHas('customer', static fn (Builder $query) => $query->where('email', $data->email))
            ->first();

        if ($order === null) {
            // Same response whether the email or the order number was wrong.
            $this->audit->record('verification.failed', AuditLog::ACTOR_CUSTOMER, [
                'email' => EmailMask::mask($data->email),
            ]);

            throw new VerificationFailed;
        }

        $conversation = DB::transaction(function () use ($order): Conversation {
            // Serialise verifications of the same order so the cap below cannot be raced past.
            Order::query()->whereKey($order->id)->lockForUpdate()->value('id');

            $recent = Conversation::query()
                ->where('order_id', $order->id)
                ->where('created_at', '>=', CarbonImmutable::now()->subDay())
                ->count();

            if ($recent >= $this->maxConversationsPerOrderPerDay) {
                throw new TooManyConversations;
            }

            $conversation = Conversation::query()->create([
                'customer_id' => $order->customer_id,
                'order_id' => $order->id,
                'status' => ConversationStatus::Open,
                'clarification_turns' => 0,
            ]);

            Message::query()->create([
                'conversation_id' => $conversation->id,
                'role' => MessageRole::Assistant,
                'content' => $this->templates->render('greeting', [
                    'firstName' => Names::firstName($order->customer->name),
                    'orderNumber' => $order->order_number,
                ]),
                'item_ids' => null,
            ]);

            $this->audit->record('conversation.started', AuditLog::ACTOR_CUSTOMER, [
                'orderNumber' => $order->order_number,
            ], conversationId: $conversation->id);

            return $conversation;
        });

        return ($this->loadConversation)($conversation);
    }
}
