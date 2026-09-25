<?php

declare(strict_types=1);

namespace App\Data;

final readonly class VerifyCustomerData
{
    /**
     * @param  string  $email  trimmed and lowercased
     * @param  string  $orderNumber  trimmed and uppercased
     */
    public function __construct(
        public string $email,
        public string $orderNumber,
    ) {}
}
