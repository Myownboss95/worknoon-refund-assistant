<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Author of a conversation message.
 */
enum MessageRole: string
{
    case Customer = 'customer';
    case Assistant = 'assistant';
    case System = 'system';
}
