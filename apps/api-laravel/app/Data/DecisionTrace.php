<?php

declare(strict_types=1);

namespace App\Data;

use App\Domain\Refunds\Policy\RuleResult;
use App\Enums\Flag;
use App\Support\Iso8601;
use DateTimeInterface;

/**
 * The full audit trail of one decision, stored as JSON on the refund request (docs/pipeline.md).
 */
final readonly class DecisionTrace
{
    /**
     * @param  list<RuleResult>  $rules
     * @param  list<string>  $heuristicMatches
     * @param  list<Flag>  $flags
     * @param  array{extract: string, compose: string}  $promptVersions
     * @param  list<AiCallRecord>  $calls
     */
    public function __construct(
        public string $policyVersion,
        public DateTimeInterface $evaluatedAt,
        public TraceFacts $facts,
        public array $rules,
        public ?Extraction $extraction,
        public array $heuristicMatches,
        public array $flags,
        public int $clarificationTurns,
        public string $provider,
        public string $model,
        public array $promptVersions,
        public array $calls,
        public ReplyGuardResult $replyGuard,
        public bool $usedTemplate,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'policyVersion' => $this->policyVersion,
            'evaluatedAt' => Iso8601::format($this->evaluatedAt),
            'facts' => $this->facts->toArray(),
            'rules' => array_map(static fn (RuleResult $rule): array => $rule->toArray(), $this->rules),
            'extraction' => $this->extraction?->toArray(),
            'heuristicMatches' => $this->heuristicMatches,
            'flags' => Flag::normalize($this->flags),
            'clarificationTurns' => $this->clarificationTurns,
            'ai' => [
                'provider' => $this->provider,
                'model' => $this->model,
                'promptVersions' => $this->promptVersions,
                'calls' => array_map(static fn (AiCallRecord $call): array => $call->toArray(), $this->calls),
            ],
            'replyGuard' => [
                'passed' => $this->replyGuard->passed(),
                'violations' => $this->replyGuard->violations,
                'usedTemplate' => $this->usedTemplate,
            ],
        ];
    }
}
