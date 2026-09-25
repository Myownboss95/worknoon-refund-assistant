<?php

declare(strict_types=1);

namespace App\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

/**
 * Append-only log of what happened, for admins. Never contains unmasked emails or message text.
 *
 * @property string $id
 * @property string $type
 * @property string $actor
 * @property string|null $conversation_id
 * @property string|null $refund_request_id
 * @property array<string, mixed> $data
 * @property CarbonImmutable $created_at
 */
#[Table(name: 'audit_events', dateFormat: 'Y-m-d H:i:s.uP')]
#[Fillable(['type', 'actor', 'conversation_id', 'refund_request_id', 'data'])]
final class AuditEvent extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }
}
