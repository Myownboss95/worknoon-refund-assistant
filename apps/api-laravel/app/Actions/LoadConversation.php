<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Conversation;

/**
 * Loads everything the customer-facing conversation views render, in a fixed number of queries.
 */
final class LoadConversation
{
    public const array RELATIONS = [
        'customer',
        'order.items.refundRequests',
        'messages',
        'refundRequest',
    ];

    public function __invoke(Conversation $conversation): Conversation
    {
        return $conversation->load(self::RELATIONS);
    }
}
