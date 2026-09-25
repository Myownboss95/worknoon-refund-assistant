<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| One customer turn at a time per conversation: a turn claims the row until locked_until
| (docs/pipeline.md, Hardening). The expiry covers a worker that crashed mid-turn.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->timestampTz('locked_until', 6)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table): void {
            $table->dropColumn('locked_until');
        });
    }
};
