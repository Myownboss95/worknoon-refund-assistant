<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;

final class ConversationClosed extends ApiException
{
    public function __construct()
    {
        parent::__construct(ErrorCode::ConversationClosed, 'This conversation is closed. Start a new one to make another request.');
    }
}
