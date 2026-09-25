<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The customer's reason, as classified by the model.
 */
enum ReasonCategory: string
{
    case Damaged = 'damaged';
    case Defective = 'defective';
    case WrongItem = 'wrong_item';
    case ChangedMind = 'changed_mind';
    case NotReceived = 'not_received';
    case Other = 'other';
    case Unclear = 'unclear';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $case): string => $case->value, self::cases());
    }
}
