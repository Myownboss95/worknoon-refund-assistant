<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Flags recorded on a refund request. R07 raises the first six; the pipeline adds the rest.
 */
enum Flag: string
{
    case HighRefundFrequency = 'HIGH_REFUND_FREQUENCY';
    case ClaimConflict = 'CLAIM_CONFLICT';
    case InjectionHeuristic = 'INJECTION_HEURISTIC';
    case InjectionModel = 'INJECTION_MODEL';
    case LowConfidence = 'LOW_CONFIDENCE';
    case AiUnavailable = 'AI_UNAVAILABLE';
    case ClarificationExhausted = 'CLARIFICATION_EXHAUSTED';
    case ReplyGuardFallback = 'REPLY_GUARD_FALLBACK';
    case ComposeUnavailable = 'COMPOSE_UNAVAILABLE';

    /**
     * Unique flag values, sorted alphabetically, as stored and returned by the API.
     *
     * @param  iterable<self>  $flags
     * @return list<string>
     */
    public static function normalize(iterable $flags): array
    {
        $values = [];

        foreach ($flags as $flag) {
            $values[$flag->value] = $flag->value;
        }

        sort($values, SORT_STRING);

        return $values;
    }
}
