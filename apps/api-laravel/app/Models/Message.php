<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\MessageRole;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $conversation_id
 * @property MessageRole $role
 * @property string $content
 * @property list<string>|null $item_ids
 * @property CarbonImmutable $created_at
 * @property-read Conversation $conversation
 */
#[Table(name: 'messages', dateFormat: 'Y-m-d H:i:s.uP')]
#[Fillable(['conversation_id', 'role', 'content', 'item_ids'])]
final class Message extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'role' => MessageRole::class,
            'item_ids' => 'array',
            'created_at' => 'immutable_datetime',
        ];
    }
}
