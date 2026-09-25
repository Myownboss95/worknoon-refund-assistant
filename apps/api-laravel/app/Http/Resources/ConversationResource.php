<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Domain\Refunds\Support\Names;
use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * VerifyResponse, or ConversationDetail when the decision is included.
 * Expects the relations in App\Actions\LoadConversation::RELATIONS.
 *
 * @property-read Conversation $resource
 */
final class ConversationResource extends JsonResource
{
    public function __construct(Conversation $resource, private readonly bool $withDecision = true)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $conversation = $this->resource;

        $data = [
            'conversation' => new ConversationSummaryResource($conversation),
            'customer' => [
                'name' => $conversation->customer->name,
                'firstName' => Names::firstName($conversation->customer->name),
            ],
            'order' => new OrderResource($conversation->order),
            'messages' => MessageResource::collection($conversation->messages),
        ];

        if ($this->withDecision) {
            $data['decision'] = $conversation->refundRequest === null
                ? null
                : new DecisionResource($conversation->refundRequest);
        }

        return $data;
    }
}
