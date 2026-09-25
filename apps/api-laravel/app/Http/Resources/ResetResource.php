<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Data\ResetResult;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read ResetResult $resource
 */
final class ResetResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'reset' => true,
            'customers' => $this->resource->customers,
            'orders' => $this->resource->orders,
        ];
    }
}
