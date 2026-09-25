<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Data\VerifyCustomerData;
use Illuminate\Foundation\Http\FormRequest;

final class VerifyCustomerRequest extends FormRequest
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
            'email' => ['required', 'string', 'max:254', 'email'],
            'orderNumber' => ['required', 'string', 'regex:/^[A-Za-z0-9-]{3,32}$/'],
        ];
    }

    public function toData(): VerifyCustomerData
    {
        return new VerifyCustomerData(
            email: mb_strtolower(trim($this->string('email')->value())),
            orderNumber: strtoupper(trim($this->string('orderNumber')->value())),
        );
    }
}
