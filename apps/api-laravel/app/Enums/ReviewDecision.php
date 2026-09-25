<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * A human reviewer's verdict on an escalated request.
 */
enum ReviewDecision: string
{
    case Approve = 'approve';
    case Deny = 'deny';
}
