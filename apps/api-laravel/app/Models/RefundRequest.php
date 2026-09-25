<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\DecidedBy;
use App\Enums\ReasonCategory;
use App\Enums\RefundStatus;
use App\Enums\ReviewDecision;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string|null $conversation_id
 * @property string $customer_id
 * @property string $order_id
 * @property RefundStatus $status
 * @property DecidedBy $decided_by
 * @property ReasonCategory|null $reason_category
 * @property int $amount_cents
 * @property string $currency
 * @property list<string> $decisive_rule_ids
 * @property list<string> $flags
 * @property array<string, mixed>|null $trace
 * @property ReviewDecision|null $review_decision
 * @property string|null $review_note
 * @property string|null $reviewed_by
 * @property CarbonImmutable|null $reviewed_at
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property-read Conversation|null $conversation
 * @property-read Customer $customer
 * @property-read Order $order
 * @property-read Collection<int, RefundRequestItem> $items
 */
#[Table(name: 'refund_requests', dateFormat: 'Y-m-d H:i:s.uP')]
#[Fillable([
    'conversation_id', 'customer_id', 'order_id', 'status', 'decided_by', 'reason_category',
    'amount_cents', 'currency', 'decisive_rule_ids', 'flags', 'trace',
    'review_decision', 'review_note', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at',
])]
final class RefundRequest extends Model
{
    use HasUuids;

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<Customer, $this>
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return HasMany<RefundRequestItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(RefundRequestItem::class);
    }

    /**
     * Requests the assistant created; imported history has no conversation.
     *
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function assistantCreated(Builder $query): void
    {
        $query->whereNotNull('conversation_id');
    }

    /**
     * @param  Builder<self>  $query
     */
    #[Scope]
    protected function newestFirst(Builder $query): void
    {
        $query->orderByDesc('created_at')->orderBy('id');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => RefundStatus::class,
            'decided_by' => DecidedBy::class,
            'reason_category' => ReasonCategory::class,
            'review_decision' => ReviewDecision::class,
            'amount_cents' => 'integer',
            'decisive_rule_ids' => 'array',
            'flags' => 'array',
            'trace' => 'array',
            'reviewed_at' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
