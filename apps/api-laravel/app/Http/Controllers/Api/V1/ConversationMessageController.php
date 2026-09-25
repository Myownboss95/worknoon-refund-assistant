<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\HandleRefundMessage;
use App\Http\Requests\SendMessageRequest;
use App\Http\Resources\MessageOutcomeResource;
use App\Models\Conversation;

final class ConversationMessageController
{
    public function store(
        SendMessageRequest $request,
        Conversation $conversation,
        HandleRefundMessage $handleRefundMessage,
    ): MessageOutcomeResource {
        return new MessageOutcomeResource($handleRefundMessage($conversation, $request->toData()));
    }
}
