<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Support;

/**
 * Money is integer cents everywhere; this is the single place it becomes text.
 */
final class Money
{
    /**
     * `129900` becomes `$1,299.00`, `5` becomes `$0.05`.
     */
    public static function format(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $cents = abs($cents);

        return sprintf(
            '%s$%s.%02d',
            $sign,
            number_format(intdiv($cents, 100), 0, '.', ','),
            $cents % 100,
        );
    }
}
