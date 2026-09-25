<?php

declare(strict_types=1);

namespace App\Data;

use App\Models\AuditEvent;
use App\Models\RefundRequest;
use Illuminate\Database\Eloquent\Collection;

final readonly class RefundRequestDetail
{
    /**
     * @param  Collection<int, AuditEvent>  $auditEvents  events for the request and its conversation, oldest first
     */
    public function __construct(
        public RefundRequest $refundRequest,
        public Collection $auditEvents,
    ) {}
}
