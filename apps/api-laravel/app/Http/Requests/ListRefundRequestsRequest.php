<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Data\RefundRequestFilters;
use App\Enums\RefundStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListRefundRequestsRequest extends FormRequest
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
            'status' => ['nullable', 'string', Rule::enum(RefundStatus::class)],
            'page' => ['nullable', 'integer', 'min:1'],
            'perPage' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    public function toFilters(): RefundRequestFilters
    {
        return new RefundRequestFilters(
            status: $this->enum('status', RefundStatus::class),
            page: $this->filled('page') ? $this->integer('page') : 1,
            perPage: $this->filled('perPage') ? $this->integer('perPage') : 20,
        );
    }
}
