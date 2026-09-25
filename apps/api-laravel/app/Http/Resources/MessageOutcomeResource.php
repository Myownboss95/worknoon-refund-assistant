<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Data\MessageOutcome;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * SendMessageResponse: the stored customer message, the reply and the decision (null while clarifying).
 *
 * @property-read MessageOutcome $resource
 */
final class MessageOutcomeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $outcome = $this->resource;

        return [
            'conversation' => new ConversationSummaryResource($outcome->conversation),
            'messages' => [
                new MessageResource($outcome->customerMessage),
                new MessageResource($outcome->reply),
            ],
            'reply' => new MessageResource($outcome->reply),
            'decision' => $outcome->refundRequest === null ? null : new DecisionResource($outcome->refundRequest),
        ];
    }
}
