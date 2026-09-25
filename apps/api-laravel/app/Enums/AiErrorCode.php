<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Short, provider-neutral failure codes recorded in the decision trace.
 */
enum AiErrorCode: string
{
    case Timeout = 'timeout';
    case ProviderError = 'provider_error';
    case InvalidOutput = 'invalid_output';
}
