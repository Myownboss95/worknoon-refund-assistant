<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Who made the current decision on a refund request.
 */
enum DecidedBy: string
{
    case Policy = 'policy';
    case Human = 'human';
    case Import = 'import';
}
