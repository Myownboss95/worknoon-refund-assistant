<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\ResetDemoData;
use App\Http\Resources\ResetResource;

final class ResetDemoController
{
    public function __invoke(ResetDemoData $resetDemoData): ResetResource
    {
        return new ResetResource($resetDemoData());
    }
}
