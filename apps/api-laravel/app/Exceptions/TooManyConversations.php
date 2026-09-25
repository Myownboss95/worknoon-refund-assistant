<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;

/**
 * The order already has MAX_CONVERSATIONS_PER_ORDER_PER_DAY conversations in the last 24 hours.
 */
final class TooManyConversations extends ApiException
{
    public function __construct()
    {
        parent::__construct(ErrorCode::RateLimited, 'Too many attempts for this order. Please try again later.');
    }
}
