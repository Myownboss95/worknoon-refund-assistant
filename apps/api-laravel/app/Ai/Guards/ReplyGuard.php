<?php

declare(strict_types=1);

namespace App\Ai\Guards;

use App\Data\ReplyGuardResult;
use App\Enums\RefundStatus;
use InvalidArgumentException;

/**
 * Checks every composed reply before it reaches the customer (contracts/reply-guard.json).
 * Any violation means the template is used instead.
 */
final readonly class ReplyGuard
{
    public const string EMPTY = 'EMPTY';

    public const string TOO_LONG = 'TOO_LONG';

    public const string CONTRADICTS_DECISION = 'CONTRADICTS_DECISION';

    public const string LEAKS_INTERNALS = 'LEAKS_INTERNALS';

    public const string WRONG_AMOUNT = 'WRONG_AMOUNT';

    private const string AMOUNT_PATTERN = '~\$\s?[\d,]+(\.\d{2})?~u';

    /**
     * @param  array<string, list<string>>  $contradictions  status to forbidden phrases
     * @param  list<string>  $leakPatterns  compiled PCRE
     */
    private function __construct(
        private int $maxLength,
        private array $contradictions,
        private array $leakPatterns,
    ) {}

    /**
     * @param  array<string, mixed>  $config  the decoded reply-guard.json
     */
    public static function fromConfig(array $config): self
    {
        $maxLength = $config['maxLength'] ?? null;
        $contradictions = $config['contradictions'] ?? null;
        $leakPatterns = $config['leakPatterns'] ?? null;

        if (! is_int($maxLength) || ! is_array($contradictions) || ! is_array($leakPatterns)) {
            throw new InvalidArgumentException('reply-guard.json is missing maxLength, contradictions or leakPatterns.');
        }

        $phrases = [];

        foreach ($contradictions as $status => $list) {
            $phrases[(string) $status] = array_values(array_filter(
                is_array($list) ? $list : [],
                is_string(...),
            ));
        }

        $compiled = array_values(array_map(
            static fn (mixed $pattern): string => '~'.(is_string($pattern) ? $pattern : '(?!)').'~iu',
            $leakPatterns,
        ));

        return new self($maxLength, $phrases, $compiled);
    }

    public function check(string $reply, RefundStatus $status, string $formattedAmount): ReplyGuardResult
    {
        if (trim($reply) === '') {
            return new ReplyGuardResult([self::EMPTY]);
        }

        $violations = [];

        if (mb_strlen($reply) > $this->maxLength) {
            $violations[] = self::TOO_LONG;
        }

        if ($this->contradicts($reply, $status)) {
            $violations[] = self::CONTRADICTS_DECISION;
        }

        if ($this->leaks($reply)) {
            $violations[] = self::LEAKS_INTERNALS;
        }

        if (! $this->amountsAreCorrect($reply, $status, $formattedAmount)) {
            $violations[] = self::WRONG_AMOUNT;
        }

        return new ReplyGuardResult($violations);
    }

    private function contradicts(string $reply, RefundStatus $status): bool
    {
        $lower = mb_strtolower($reply);

        foreach ($this->contradictions[$status->value] ?? [] as $phrase) {
            if (str_contains($lower, mb_strtolower($phrase))) {
                return true;
            }
        }

        return false;
    }

    private function leaks(string $reply): bool
    {
        foreach ($this->leakPatterns as $pattern) {
            if (preg_match($pattern, $reply) === 1) {
                return true;
            }
        }

        return false;
    }

    /**
     * Approved: every dollar amount must be exactly the decision amount. Otherwise: no dollar amounts.
     */
    private function amountsAreCorrect(string $reply, RefundStatus $status, string $formattedAmount): bool
    {
        preg_match_all(self::AMOUNT_PATTERN, $reply, $matches);
        $amounts = $matches[0];

        if ($status !== RefundStatus::Approved) {
            return $amounts === [];
        }

        foreach ($amounts as $amount) {
            if (preg_replace('~\s+~u', '', $amount) !== $formattedAmount) {
                return false;
            }
        }

        return true;
    }
}
