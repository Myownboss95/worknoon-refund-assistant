<?php

declare(strict_types=1);

namespace App\Support;

use DateTimeInterface;
use DateTimeZone;
use Illuminate\Support\Carbon;

/**
 * API timestamps: UTC, millisecond precision, trailing Z (2026-09-25T10:00:00.000Z).
 */
final class Iso8601
{
    public static function format(DateTimeInterface $date): string
    {
        return Carbon::instance($date)->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s.v\Z');
    }

    public static function formatOrNull(?DateTimeInterface $date): ?string
    {
        return $date === null ? null : self::format($date);
    }
}
