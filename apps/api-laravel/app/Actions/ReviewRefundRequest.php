<?php

declare(strict_types=1);

namespace App\Actions;

use App\Data\RefundRequestDetail;
use App\Data\ReviewData;
use App\Domain\Refunds\Support\Money;
use App\Domain\Refunds\Support\TemplateRenderer;
use App\Enums\DecidedBy;
use App\Enums\MessageRole;
use App\Enums\RefundStatus;
use App\Enums\ReviewDecision;
use App\Exceptions\RefundNotReviewable;
use App\Models\Message;
use App\Models\RefundRequest;
use App\Support\AuditLog;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * POST /admin/refund-requests/{id}/review: a human settles an escalated request.
 */
final readonly class ReviewRefundRequest
{
    public function __construct(
        private TemplateRenderer $templates,
        private AuditLog $audit,
        private LoadRefundRequestDetail $loadDetail,
    ) {}

    public function __invoke(RefundRequest $refundRequest, ReviewData $data): RefundRequestDetail
    {
        $reviewed = DB::transaction(function () use ($refundRequest, $data): RefundRequest {
            $locked = RefundRequest::query()->lockForUpdate()->findOrFail($refundRequest->id);

            if ($locked->status !== RefundStatus::Escalated) {
                throw new RefundNotReviewable;
            }

            $locked->update([
                'status' => RefundStatus::fromReview($data->decision),
                'decided_by' => DecidedBy::Human,
                'review_decision' => $data->decision,
                'review_note' => $data->note,
                'reviewed_by' => $data->reviewer,
                'reviewed_at' => CarbonImmutable::now(),
            ]);

            if ($locked->conversation_id !== null) {
                Message::query()->create([
                    'conversation_id' => $locked->conversation_id,
                    'role' => MessageRole::System,
                    'content' => $this->templates->render(
                        $data->decision === ReviewDecision::Approve ? 'humanApproved' : 'humanDenied',
                        ['amount' => Money::format($locked->amount_cents), 'note' => $data->note],
                    ),
                    'item_ids' => null,
                ]);
            }

            $this->audit->record('refund.reviewed', AuditLog::ACTOR_ADMIN, [
                'decision' => $data->decision->value,
                'note' => $data->note,
            ], conversationId: $locked->conversation_id, refundRequestId: $locked->id);

            return $locked;
        });

        return ($this->loadDetail)($reviewed);
    }
}
