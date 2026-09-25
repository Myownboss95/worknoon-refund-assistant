<?php

declare(strict_types=1);

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

/**
 * RefundRequestList: `{ data: [...], meta: { page, perPage, total, lastPage } }`.
 */
final class RefundRequestCollection extends ResourceCollection
{
    public $collects = RefundRequestSummaryResource::class;

    /**
     * @param  array<string, mixed>  $paginated
     * @param  array<string, mixed>  $default
     * @return array<string, mixed>
     */
    public function paginationInformation(Request $request, array $paginated, array $default): array
    {
        return [
            'meta' => [
                'page' => (int) $paginated['current_page'],
                'perPage' => (int) $paginated['per_page'],
                'total' => (int) $paginated['total'],
                'lastPage' => max(1, (int) $paginated['last_page']),
            ],
        ];
    }
}
