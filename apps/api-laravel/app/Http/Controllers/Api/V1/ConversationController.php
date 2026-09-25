<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\LoadConversation;
use App\Http\Resources\ConversationResource;
use App\Models\Conversation;

final class ConversationController
{
    public function show(Conversation $conversation, LoadConversation $loadConversation): ConversationResource
    {
        return new ConversationResource($loadConversation($conversation));
    }
}
