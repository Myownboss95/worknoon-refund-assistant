<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * A conversation is closed once a decision is reached.
 */
enum ConversationStatus: string
{
    case Open = 'open';
    case Closed = 'closed';
}
