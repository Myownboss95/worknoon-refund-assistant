<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;

final class RefundNotReviewable extends ApiException
{
    public function __construct()
    {
        parent::__construct(ErrorCode::RefundNotReviewable, 'Only escalated refund requests can be reviewed.');
    }
}
