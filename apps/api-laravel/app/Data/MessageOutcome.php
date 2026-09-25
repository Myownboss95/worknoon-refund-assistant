<?php

declare(strict_types=1);

namespace App\Data;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\RefundRequest;

/**
 * What one customer turn produced: the stored message, the assistant's reply and, once the
 * pipeline has decided, the refund request.
 */
final readonly class MessageOutcome
{
    public function __construct(
        public Conversation $conversation,
        public Message $customerMessage,
        public Message $reply,
        public ?RefundRequest $refundRequest,
    ) {}
}
