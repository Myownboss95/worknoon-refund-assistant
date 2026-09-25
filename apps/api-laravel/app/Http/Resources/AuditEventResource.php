<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\AuditEvent;
use App\Support\Iso8601;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read AuditEvent $resource
 */
final class AuditEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $event = $this->resource;

        return [
            'id' => $event->id,
            'type' => $event->type,
            'actor' => $event->actor,
            // Always a JSON object, even when empty.
            'data' => (object) $event->data,
            'createdAt' => Iso8601::format($event->created_at),
        ];
    }
}
