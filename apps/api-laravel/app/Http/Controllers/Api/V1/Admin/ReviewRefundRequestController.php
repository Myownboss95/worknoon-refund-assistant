<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\ReviewRefundRequest;
use App\Http\Requests\ReviewRefundRequestRequest;
use App\Http\Resources\RefundRequestDetailResource;
use App\Models\RefundRequest;

final class ReviewRefundRequestController
{
    public function __invoke(
        ReviewRefundRequestRequest $request,
        RefundRequest $refundRequest,
        ReviewRefundRequest $reviewRefundRequest,
    ): RefundRequestDetailResource {
        return new RefundRequestDetailResource($reviewRefundRequest($refundRequest, $request->toData()));
    }
}
