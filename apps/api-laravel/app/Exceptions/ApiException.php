<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;
use RuntimeException;

/**
 * An expected, client-facing error. Rendered by bootstrap/app.php as
 * `{ "error": { "code": ..., "message": ... } }` with the code's HTTP status.
 */
abstract class ApiException extends RuntimeException
{
    public function __construct(public readonly ErrorCode $errorCode, string $message)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->errorCode->status();
    }
}
