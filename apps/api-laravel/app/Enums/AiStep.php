<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * The two model calls the pipeline makes.
 */
enum AiStep: string
{
    case Extract = 'extract';
    case Compose = 'compose';
}
