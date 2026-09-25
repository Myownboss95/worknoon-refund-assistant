<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Data\SendMessageData;
use App\Domain\Refunds\Policy\PolicyConfig;
use App\Models\Conversation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SendMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(PolicyConfig $config): array
    {
        return [
            'text' => ['required', 'string', 'max:'.$config->maxMessageLength],
            'itemIds' => ['required', 'list', 'min:1', 'max:'.$config->maxItemsPerRequest],
            'itemIds.*' => [
                'bail',
                'string',
                'uuid',
                'distinct',
                Rule::exists('order_items', 'id')->where('order_id', $this->conversation()->order_id),
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'itemIds.*.exists' => 'Every item must belong to this order.',
            'itemIds.*.distinct' => 'Each item may only be selected once.',
            'itemIds.*.uuid' => 'Every item id must be a valid UUID.',
        ];
    }

    public function toData(): SendMessageData
    {
        /** @var list<string> $itemIds */
        $itemIds = $this->validated('itemIds');

        return new SendMessageData(
            text: $this->string('text')->value(),
            itemIds: $itemIds,
        );
    }

    protected function prepareForValidation(): void
    {
        $text = $this->input('text');

        if (is_string($text)) {
            // Strip control characters except newline and tab, then trim.
            $this->merge(['text' => trim((string) preg_replace('/[^\P{Cc}\n\t]/u', '', $text))]);
        }
    }

    private function conversation(): Conversation
    {
        $conversation = $this->route('conversation');

        return $conversation instanceof Conversation ? $conversation : new Conversation;
    }
}
