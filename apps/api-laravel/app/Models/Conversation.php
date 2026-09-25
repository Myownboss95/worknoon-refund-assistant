<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\ConversationStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property string $id
 * @property string $customer_id
 * @property string $order_id
 * @property ConversationStatus $status
 * @property int $clarification_turns
 * @property CarbonImmutable|null $locked_until
 * @property CarbonImmutable $created_at
 * @property CarbonImmutable $updated_at
 * @property-read Customer $customer
 * @property-read Order $order
 * @property-read Collection<int, Message> $messages
 * @property-read RefundRequest|null $refundRequest
 */
#[Table(name: 'conversations', dateFormat: 'Y-m-d H:i:s.uP')]
#[Fillable(['customer_id', 'order_id', 'status', 'clarification_turns'])]
final class Conversation extends Model
{
    use HasUuids;

    /**
     * @var array<string, mixed>
     */
    protected $attributes = [
        'status' => 'open',
        'clarification_turns' => 0,
    ];

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
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at')->orderBy('id');
    }

    /**
     * @return HasOne<RefundRequest, $this>
     */
    public function refundRequest(): HasOne
    {
        return $this->hasOne(RefundRequest::class);
    }

    public function isClosed(): bool
    {
        return $this->status === ConversationStatus::Closed;
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ConversationStatus::class,
            'clarification_turns' => 'integer',
            'locked_until' => 'immutable_datetime',
            'created_at' => 'immutable_datetime',
            'updated_at' => 'immutable_datetime',
        ];
    }
}
