<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Error codes returned in the API error envelope.
 */
enum ErrorCode: string
{
    case ValidationFailed = 'VALIDATION_FAILED';
    case VerificationFailed = 'VERIFICATION_FAILED';
    case NotFound = 'NOT_FOUND';
    case ConversationClosed = 'CONVERSATION_CLOSED';
    case ConversationBusy = 'CONVERSATION_BUSY';
    case RefundAlreadyExists = 'REFUND_ALREADY_EXISTS';
    case RefundNotReviewable = 'REFUND_NOT_REVIEWABLE';
    case AdminUnauthorized = 'ADMIN_UNAUTHORIZED';
    case RateLimited = 'RATE_LIMITED';
    case AiUnavailable = 'AI_UNAVAILABLE';
    case InternalError = 'INTERNAL_ERROR';

    public function status(): int
    {
        return match ($this) {
            self::ValidationFailed => 422,
            self::VerificationFailed, self::NotFound => 404,
            self::ConversationClosed, self::ConversationBusy, self::RefundAlreadyExists, self::RefundNotReviewable => 409,
            self::AdminUnauthorized => 401,
            self::RateLimited => 429,
            self::AiUnavailable => 503,
            self::InternalError => 500,
        };
    }
}
