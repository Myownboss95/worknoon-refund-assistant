<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Data\ReviewData;
use App\Enums\ReviewDecision;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ReviewRefundRequestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', 'string', Rule::enum(ReviewDecision::class)],
            'note' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    public function toData(): ReviewData
    {
        return new ReviewData(
            decision: ReviewDecision::from($this->string('decision')->value()),
            note: $this->string('note')->value(),
        );
    }
}
