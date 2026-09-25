<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Support;

/**
 * Emails are never logged or audited in full.
 */
final class EmailMask
{
    /**
     * `ada.okafor@example.com` becomes `a***@example.com`.
     */
    public static function mask(string $email): string
    {
        $at = strrpos($email, '@');

        if ($at === false || $at === 0) {
            return '***';
        }

        return mb_substr($email, 0, 1).'***@'.substr($email, $at + 1);
    }
}
