<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Conversation;
use App\Support\Iso8601;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read Conversation $resource
 */
final class ConversationSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $conversation = $this->resource;

        return [
            'id' => $conversation->id,
            'status' => $conversation->status->value,
            'clarificationTurns' => $conversation->clarification_turns,
            'createdAt' => Iso8601::format($conversation->created_at),
        ];
    }
}
