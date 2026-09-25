<?php

declare(strict_types=1);

namespace App\Data;

final readonly class ReplyGuardResult
{
    /**
     * @param  list<string>  $violations  violation codes, e.g. TOO_LONG, LEAKS_INTERNALS
     */
    public function __construct(public array $violations) {}

    public function passed(): bool
    {
        return $this->violations === [];
    }
}
