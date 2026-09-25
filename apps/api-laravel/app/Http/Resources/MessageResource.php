<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Enums\MessageRole;
use App\Models\Message;
use App\Support\Iso8601;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read Message $resource
 */
final class MessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $message = $this->resource;

        return [
            'id' => $message->id,
            'role' => $message->role->value,
            'content' => $message->content,
            'itemIds' => $message->role === MessageRole::Customer ? ($message->item_ids ?? []) : null,
            'createdAt' => Iso8601::format($message->created_at),
        ];
    }
}
