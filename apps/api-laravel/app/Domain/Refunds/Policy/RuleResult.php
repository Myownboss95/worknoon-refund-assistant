<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy;

use App\Enums\Flag;
use App\Enums\RuleOutcome;

final readonly class RuleResult
{
    /**
     * @param  string  $reason  short internal English sentence for the admin trace, never shown to customers
     * @param  list<Flag>  $flags  signals the rule raised (only R07 raises flags)
     */
    public function __construct(
        public string $ruleId,
        public RuleOutcome $outcome,
        public string $reason,
        public array $flags = [],
    ) {}

    public static function pass(string $ruleId, string $reason): self
    {
        return new self($ruleId, RuleOutcome::Pass, $reason);
    }

    public static function notApplicable(string $ruleId, string $reason): self
    {
        return new self($ruleId, RuleOutcome::NotApplicable, $reason);
    }

    public static function deny(string $ruleId, string $reason): self
    {
        return new self($ruleId, RuleOutcome::Deny, $reason);
    }

    /**
     * @param  list<Flag>  $flags
     */
    public static function escalate(string $ruleId, string $reason, array $flags = []): self
    {
        return new self($ruleId, RuleOutcome::Escalate, $reason, $flags);
    }

    public static function approve(string $ruleId, string $reason): self
    {
        return new self($ruleId, RuleOutcome::Approve, $reason);
    }

    /**
     * @return array{ruleId: string, outcome: string, reason: string}
     */
    public function toArray(): array
    {
        return [
            'ruleId' => $this->ruleId,
            'outcome' => $this->outcome->value,
            'reason' => $this->reason,
        ];
    }
}
