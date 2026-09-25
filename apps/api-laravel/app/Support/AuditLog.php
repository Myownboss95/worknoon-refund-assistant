<?php

declare(strict_types=1);

namespace App\Support;

use App\Models\AuditEvent;

/**
 * Writes audit events. Callers must never pass message text or unmasked emails in `data`.
 */
final class AuditLog
{
    public const string ACTOR_SYSTEM = 'system';

    public const string ACTOR_CUSTOMER = 'customer';

    public const string ACTOR_ADMIN = 'admin';

    /**
     * @param  array<string, mixed>  $data
     */
    public function record(
        string $type,
        string $actor,
        array $data = [],
        ?string $conversationId = null,
        ?string $refundRequestId = null,
    ): AuditEvent {
        return AuditEvent::query()->create([
            'type' => $type,
            'actor' => $actor,
            'conversation_id' => $conversationId,
            'refund_request_id' => $refundRequestId,
            'data' => $data,
        ]);
    }
}
