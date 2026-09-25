<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;

final class AdminUnauthorized extends ApiException
{
    public function __construct()
    {
        parent::__construct(ErrorCode::AdminUnauthorized, 'A valid admin token is required.');
    }
}
