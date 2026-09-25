<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Ai\Contracts\RefundAnalyzer;
use App\Domain\Refunds\Policy\PolicyConfig;
use App\Support\Iso8601;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Throwable;

final class HealthController
{
    public function __invoke(RefundAnalyzer $analyzer, PolicyConfig $config): JsonResponse
    {
        try {
            DB::select('select 1');
            $databaseUp = true;
        } catch (Throwable) {
            $databaseUp = false;
        }

        return new JsonResponse([
            'status' => $databaseUp ? 'ok' : 'degraded',
            'backend' => 'laravel',
            'database' => $databaseUp ? 'ok' : 'down',
            'ai' => ['provider' => $analyzer->provider(), 'model' => $analyzer->model()],
            'policyVersion' => $config->version,
            'time' => Iso8601::format(CarbonImmutable::now()),
        ], $databaseUp ? 200 : 503);
    }
}
