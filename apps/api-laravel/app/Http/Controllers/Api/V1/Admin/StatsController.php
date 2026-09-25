<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\Admin;

use App\Actions\GetStats;
use App\Http\Resources\StatsResource;

final class StatsController
{
    public function __invoke(GetStats $getStats): StatsResource
    {
        return new StatsResource($getStats());
    }
}
