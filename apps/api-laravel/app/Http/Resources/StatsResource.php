<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Data\StatsData;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read StatsData $resource
 */
final class StatsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $stats = $this->resource;

        return [
            'total' => $stats->total,
            'byStatus' => [
                'approved' => $stats->approved,
                'denied' => $stats->denied,
                'escalated' => $stats->escalated,
            ],
            'escalatedTotal' => $stats->escalatedTotal,
            'humanReviewed' => $stats->humanReviewed,
            'escalationRate' => $stats->escalationRate,
            'autoResolutionRate' => $stats->autoResolutionRate,
        ];
    }
}
