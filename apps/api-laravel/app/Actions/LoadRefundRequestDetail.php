<?php

declare(strict_types=1);

namespace App\Actions;

use App\Data\RefundRequestDetail;
use App\Models\AuditEvent;
use App\Models\RefundRequest;
use Illuminate\Database\Eloquent\Builder;

/**
 * Everything the admin detail view shows: items, conversation, trace, review and audit history.
 */
final class LoadRefundRequestDetail
{
    public function __invoke(RefundRequest $refundRequest): RefundRequestDetail
    {
        $refundRequest->load(['customer', 'order', 'items.orderItem', 'conversation.messages']);

        $auditEvents = AuditEvent::query()
            ->where(static function (Builder $query) use ($refundRequest): void {
                $query->where('refund_request_id', $refundRequest->id);

                if ($refundRequest->conversation_id !== null) {
                    $query->orWhere('conversation_id', $refundRequest->conversation_id);
                }
            })
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return new RefundRequestDetail($refundRequest, $auditEvents);
    }
}
