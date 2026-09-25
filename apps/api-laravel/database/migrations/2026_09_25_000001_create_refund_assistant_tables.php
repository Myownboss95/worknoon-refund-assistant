<?php

declare(strict_types=1);

use App\Enums\ConversationStatus;
use App\Enums\DecidedBy;
use App\Enums\MessageRole;
use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;
use App\Enums\RefundStatus;
use App\Enums\ReviewDecision;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->string('email', 254)->unique();
            $table->timestampTz('created_at', 6)->useCurrent();
        });

        Schema::create('orders', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained()->cascadeOnDelete();
            $table->string('order_number', 32)->unique();
            $table->enum('status', self::values(OrderStatus::cases()));
            $table->timestampTz('placed_at', 6);
            $table->timestampTz('delivered_at', 6)->nullable();
            $table->timestampTz('created_at', 6)->useCurrent();
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $table->string('sku', 64);
            $table->string('name');
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('quantity');
            $table->boolean('final_sale')->default(false);
        });

        Schema::create('conversations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $table->enum('status', self::values(ConversationStatus::cases()))->default(ConversationStatus::Open->value);
            $table->unsignedSmallInteger('clarification_turns')->default(0);
            $table->timestampsTz(6);
        });

        Schema::create('messages', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained()->cascadeOnDelete();
            $table->enum('role', self::values(MessageRole::cases()));
            $table->text('content');
            $table->jsonb('item_ids')->nullable();
            $table->timestampTz('created_at', 6)->useCurrent();

            $table->index(['conversation_id', 'created_at']);
        });

        Schema::create('refund_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            // Null for imported history; one decision per conversation otherwise.
            $table->foreignUuid('conversation_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->foreignUuid('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('order_id')->constrained()->cascadeOnDelete();
            $table->enum('status', self::values(RefundStatus::cases()));
            $table->enum('decided_by', self::values(DecidedBy::cases()));
            $table->enum('reason_category', self::values(ReasonCategory::cases()))->nullable();
            $table->unsignedInteger('amount_cents');
            $table->char('currency', 3);
            $table->jsonb('decisive_rule_ids');
            $table->jsonb('flags');
            $table->json('trace')->nullable();
            $table->enum('review_decision', self::values(ReviewDecision::cases()))->nullable();
            $table->text('review_note')->nullable();
            $table->string('reviewed_by')->nullable();
            $table->timestampTz('reviewed_at', 6)->nullable();
            $table->timestampsTz(6);

            $table->index(['customer_id', 'status', 'created_at']);
            $table->index(['status', 'created_at']);
            $table->index('created_at');
        });

        Schema::create('refund_request_items', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('refund_request_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('order_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('amount_cents');

            $table->unique(['refund_request_id', 'order_item_id']);
            $table->index('order_item_id');
        });

        Schema::create('audit_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('type', 64);
            $table->string('actor', 32);
            $table->foreignUuid('conversation_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignUuid('refund_request_id')->nullable()->constrained()->cascadeOnDelete();
            $table->json('data');
            $table->timestampTz('created_at', 6)->useCurrent();

            $table->index(['type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('refund_request_items');
        Schema::dropIfExists('refund_requests');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('customers');
    }

    /**
     * @param  list<BackedEnum>  $cases
     * @return list<string>
     */
    private static function values(array $cases): array
    {
        return array_map(static fn (BackedEnum $case): string => (string) $case->value, $cases);
    }
};
