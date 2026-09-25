<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Support;

use App\Domain\Refunds\Policy\PolicyConfig;
use App\Enums\DecidedBy;
use App\Enums\RefundStatus;

/**
 * The customer-safe explanation of a decision (`Decision.customerReason` in the API).
 * Never includes flags or internal rule reasons.
 */
final class CustomerReason
{
    public const string ESCALATED = 'A member of our support team will review your request within one business day.';

    public const string HUMAN_DENIED = "After reviewing your request, we're unable to offer a refund.";

    /**
     * @param  list<string>  $decisiveRuleIds
     */
    public static function for(
        RefundStatus $status,
        DecidedBy $decidedBy,
        array $decisiveRuleIds,
        int $amountCents,
        PolicyConfig $config,
    ): string {
        return match ($status) {
            RefundStatus::Approved => 'Your refund of '.Money::format($amountCents).' has been approved.',
            RefundStatus::Escalated => self::ESCALATED,
            RefundStatus::Denied => self::denied($decidedBy, $decisiveRuleIds, $config),
        };
    }

    /**
     * The customer-safe sentences for the given rules, joined with a single space.
     *
     * @param  list<string>  $ruleIds
     */
    public static function forRules(array $ruleIds, PolicyConfig $config): string
    {
        return implode(' ', self::sentences($ruleIds, $config));
    }

    /**
     * @param  list<string>  $ruleIds
     * @return list<string>
     */
    public static function sentences(array $ruleIds, PolicyConfig $config): array
    {
        return array_values(array_filter(array_map(
            static fn (string $ruleId): ?string => $config->customerReasonFor($ruleId),
            $ruleIds,
        ), static fn (?string $sentence): bool => $sentence !== null && $sentence !== ''));
    }

    /**
     * @param  list<string>  $decisiveRuleIds
     */
    private static function denied(DecidedBy $decidedBy, array $decisiveRuleIds, PolicyConfig $config): string
    {
        // A human denial overrides escalation rules, which have no customer-safe sentence.
        if ($decidedBy === DecidedBy::Human) {
            return self::HUMAN_DENIED;
        }

        $reasons = self::forRules($decisiveRuleIds, $config);

        return $reasons !== '' ? $reasons : self::HUMAN_DENIED;
    }
}
