<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\ResetDemoData;
use App\Http\Resources\ResetResource;
use Illuminate\Config\Repository;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Only available when DEMO_MODE is true; otherwise 404, after the admin token check.
 */
final class ResetDemoController
{
    public function __invoke(ResetDemoData $resetDemoData, Repository $config): ResetResource
    {
        if (! $config->boolean('refunds.demo_mode')) {
            throw new NotFoundHttpException;
        }

        return new ResetResource($resetDemoData());
    }
}
