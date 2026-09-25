<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\AiErrorCode;
use RuntimeException;
use Throwable;

/**
 * A model call failed. Carries only a short code; provider messages never reach the trace or logs.
 */
final class AnalyzerFailed extends RuntimeException
{
    public function __construct(public readonly AiErrorCode $errorCode, ?Throwable $previous = null)
    {
        parent::__construct("AI call failed: {$errorCode->value}", 0, $previous);
    }
}
