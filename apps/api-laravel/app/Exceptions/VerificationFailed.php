<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;

/**
 * Deliberately generic: never reveals whether the email or the order number was wrong.
 */
final class VerificationFailed extends ApiException
{
    public function __construct()
    {
        parent::__construct(ErrorCode::VerificationFailed, "We couldn't find an order matching those details.");
    }
}
