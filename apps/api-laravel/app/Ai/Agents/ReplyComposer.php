<?php

declare(strict_types=1);

namespace App\Ai\Agents;

use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Attributes\Provider;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;

/**
 * Words a decision the policy engine has already made. Plain text out; the reply guard checks it.
 */
#[Provider(Lab::Anthropic)]
#[Temperature(0.3)]
#[MaxTokens(400)]
final class ReplyComposer implements Agent
{
    use Promptable;

    public function __construct(private readonly string $systemPrompt) {}

    public function instructions(): string
    {
        return $this->systemPrompt;
    }
}
