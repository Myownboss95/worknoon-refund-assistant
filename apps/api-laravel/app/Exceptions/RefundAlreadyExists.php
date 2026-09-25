<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;

final class RefundAlreadyExists extends ApiException
{
    public function __construct()
    {
        parent::__construct(ErrorCode::RefundAlreadyExists, 'A refund request for one of these items was made in the meantime.');
    }
}
