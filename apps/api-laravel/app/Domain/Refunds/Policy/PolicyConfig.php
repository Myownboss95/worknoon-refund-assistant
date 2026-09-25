<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy;

use App\Enums\ReasonCategory;
use InvalidArgumentException;

/**
 * Typed view of contracts/policy.config.json. Thresholds live there, not in rule code.
 */
final readonly class PolicyConfig
{
    /**
     * @param  list<ReasonCategory>  $approvableReasons
     * @param  list<ReasonCategory>  $merchantFaultReasons
     * @param  array<string, string>  $customerReasons  rule id to customer-safe sentence (may contain placeholders)
     */
    public function __construct(
        public string $version,
        public string $currency,
        public int $refundWindowDays,
        public int $changeOfMindWindowDays,
        public int $humanReviewThresholdCents,
        public int $suspiciousRefundCount,
        public int $suspiciousRefundLookbackDays,
        public float $minAiConfidence,
        public int $maxClarificationTurns,
        public int $maxMessageLength,
        public int $maxItemsPerRequest,
        public array $approvableReasons,
        public array $merchantFaultReasons,
        public array $customerReasons,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            version: self::string($data, 'version'),
            currency: self::string($data, 'currency'),
            refundWindowDays: self::int($data, 'refundWindowDays'),
            changeOfMindWindowDays: self::int($data, 'changeOfMindWindowDays'),
            humanReviewThresholdCents: self::int($data, 'humanReviewThresholdCents'),
            suspiciousRefundCount: self::int($data, 'suspiciousRefundCount'),
            suspiciousRefundLookbackDays: self::int($data, 'suspiciousRefundLookbackDays'),
            minAiConfidence: self::float($data, 'minAiConfidence'),
            maxClarificationTurns: self::int($data, 'maxClarificationTurns'),
            maxMessageLength: self::int($data, 'maxMessageLength'),
            maxItemsPerRequest: self::int($data, 'maxItemsPerRequest'),
            approvableReasons: self::reasons($data, 'approvableReasons'),
            merchantFaultReasons: self::reasons($data, 'merchantFaultReasons'),
            customerReasons: self::customerReasons($data),
        );
    }

    public function isApprovable(?ReasonCategory $reason): bool
    {
        return $reason !== null && in_array($reason, $this->approvableReasons, true);
    }

    public function isMerchantFault(?ReasonCategory $reason): bool
    {
        return $reason !== null && in_array($reason, $this->merchantFaultReasons, true);
    }

    /**
     * The customer-safe sentence for a rule, with policy placeholders filled, or null if the rule has none.
     */
    public function customerReasonFor(string $ruleId): ?string
    {
        $reason = $this->customerReasons[$ruleId] ?? null;

        if ($reason === null) {
            return null;
        }

        return strtr($reason, [
            '{refundWindowDays}' => (string) $this->refundWindowDays,
            '{changeOfMindWindowDays}' => (string) $this->changeOfMindWindowDays,
            '{humanReviewThresholdCents}' => (string) $this->humanReviewThresholdCents,
            '{suspiciousRefundCount}' => (string) $this->suspiciousRefundCount,
            '{suspiciousRefundLookbackDays}' => (string) $this->suspiciousRefundLookbackDays,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function string(array $data, string $key): string
    {
        $value = $data[$key] ?? null;

        return is_string($value) ? $value : throw self::invalid($key);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function int(array $data, string $key): int
    {
        $value = $data[$key] ?? null;

        return is_int($value) ? $value : throw self::invalid($key);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function float(array $data, string $key): float
    {
        $value = $data[$key] ?? null;

        return is_int($value) || is_float($value) ? (float) $value : throw self::invalid($key);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return list<ReasonCategory>
     */
    private static function reasons(array $data, string $key): array
    {
        $values = $data[$key] ?? null;

        if (! is_array($values)) {
            throw self::invalid($key);
        }

        return array_values(array_map(
            static fn (mixed $value): ReasonCategory => is_string($value)
                ? ReasonCategory::from($value)
                : throw self::invalid($key),
            $values,
        ));
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, string>
     */
    private static function customerReasons(array $data): array
    {
        $values = $data['customerReasons'] ?? null;

        if (! is_array($values)) {
            throw self::invalid('customerReasons');
        }

        $reasons = [];

        foreach ($values as $ruleId => $text) {
            if (! is_string($ruleId) || ! is_string($text)) {
                throw self::invalid('customerReasons');
            }

            $reasons[$ruleId] = $text;
        }

        return $reasons;
    }

    private static function invalid(string $key): InvalidArgumentException
    {
        return new InvalidArgumentException("policy.config.json: missing or invalid [{$key}].");
    }
}
