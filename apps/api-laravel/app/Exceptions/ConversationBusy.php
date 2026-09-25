<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;

/**
 * Another turn on the same conversation is still being processed (one turn at a time).
 */
final class ConversationBusy extends ApiException
{
    public function __construct()
    {
        parent::__construct(ErrorCode::ConversationBusy, "We're still working on your previous message.");
    }
}
