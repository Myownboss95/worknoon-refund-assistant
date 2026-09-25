<?php

declare(strict_types=1);

namespace App\Actions;

use App\Data\ResetResult;
use Illuminate\Support\Facades\DB;

/**
 * POST /admin/demo/reset: truncate every table and re-seed from contracts/scenarios.json.
 */
final readonly class ResetDemoData
{
    public const array TABLES = [
        'audit_events',
        'refund_request_items',
        'refund_requests',
        'messages',
        'conversations',
        'order_items',
        'orders',
        'customers',
    ];

    public function __construct(private ImportScenarios $importScenarios) {}

    public function __invoke(): ResetResult
    {
        return DB::transaction(function (): ResetResult {
            DB::statement('truncate table '.implode(', ', self::TABLES).' restart identity cascade');

            return ($this->importScenarios)();
        });
    }
}
