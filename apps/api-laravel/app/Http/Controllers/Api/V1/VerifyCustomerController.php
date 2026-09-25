<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Actions\VerifyCustomer;
use App\Http\Requests\VerifyCustomerRequest;
use App\Http\Resources\ConversationResource;
use Illuminate\Http\JsonResponse;

final class VerifyCustomerController
{
    public function __invoke(VerifyCustomerRequest $request, VerifyCustomer $verifyCustomer): JsonResponse
    {
        $conversation = $verifyCustomer($request->toData());

        return (new ConversationResource($conversation, withDecision: false))
            ->response()
            ->setStatusCode(201);
    }
}
