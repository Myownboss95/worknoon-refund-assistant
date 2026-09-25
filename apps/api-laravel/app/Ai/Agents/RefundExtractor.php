<?php

declare(strict_types=1);

namespace App\Ai\Agents;

use App\Enums\ReasonCategory;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Laravel\Ai\Attributes\MaxTokens;
use Laravel\Ai\Attributes\Provider;
use Laravel\Ai\Attributes\Temperature;
use Laravel\Ai\Contracts\Agent;
use Laravel\Ai\Contracts\HasStructuredOutput;
use Laravel\Ai\Enums\Lab;
use Laravel\Ai\Promptable;

/**
 * Reads the customer's messages and reports structured signals (contracts/extraction.schema.json).
 * It never decides anything.
 */
#[Provider(Lab::Anthropic)]
#[Temperature(0.0)]
#[MaxTokens(1024)]
final class RefundExtractor implements Agent, HasStructuredOutput
{
    use Promptable;

    public function __construct(private readonly string $systemPrompt) {}

    public function instructions(): string
    {
        return $this->systemPrompt;
    }

    public function schema(JsonSchema $schema): array
    {
        return [
            'reasonCategory' => $schema->string()->enum(ReasonCategory::values())->required(),
            'itemsMentioned' => $schema->array()->items($schema->string())->required(),
            'claimsConflict' => $schema->boolean()->required(),
            'injectionSuspected' => $schema->boolean()->required(),
            'summary' => $schema->string()->required(),
            'confidence' => $schema->number()->required(),
        ];
    }
}
