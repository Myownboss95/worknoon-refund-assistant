<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Actions\ImportScenarios;
use App\Models\Customer;
use Illuminate\Database\Seeder;

/**
 * Seeds the demo scenarios from contracts/scenarios.json. Idempotent: does nothing once any
 * customer exists, so it is safe to run on every boot.
 */
final class ScenarioSeeder extends Seeder
{
    public function run(ImportScenarios $importScenarios): void
    {
        if (Customer::query()->exists()) {
            return;
        }

        $importScenarios();
    }
}
