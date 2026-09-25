<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\ListRefundRequests;
use App\Actions\LoadRefundRequestDetail;
use App\Http\Requests\ListRefundRequestsRequest;
use App\Http\Resources\RefundRequestCollection;
use App\Http\Resources\RefundRequestDetailResource;
use App\Models\RefundRequest;

final class RefundRequestController
{
    public function index(ListRefundRequestsRequest $request, ListRefundRequests $listRefundRequests): RefundRequestCollection
    {
        return new RefundRequestCollection($listRefundRequests($request->toFilters()));
    }

    public function show(RefundRequest $refundRequest, LoadRefundRequestDetail $loadDetail): RefundRequestDetailResource
    {
        return new RefundRequestDetailResource($loadDetail($refundRequest));
    }
}
