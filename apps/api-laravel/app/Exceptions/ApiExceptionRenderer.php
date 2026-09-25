<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Enums\ErrorCode;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Renders every error as `{ "error": { "code", "message", "details"? } }` (docs/pipeline.md, Errors).
 */
final class ApiExceptionRenderer
{
    public function render(Throwable $exception): JsonResponse
    {
        return match (true) {
            $exception instanceof ApiException => self::error($exception->errorCode, $exception->getMessage()),
            $exception instanceof ValidationException => self::validation($exception),
            $exception instanceof ThrottleRequestsException => self::error(
                ErrorCode::RateLimited,
                'Too many requests. Please wait a moment and try again.',
                headers: $exception->getHeaders(),
            ),
            // Unknown paths, unknown or malformed ids, and unsupported methods all look the same.
            $exception instanceof NotFoundHttpException,
            $exception instanceof MethodNotAllowedHttpException => self::error(ErrorCode::NotFound, 'The requested resource was not found.'),
            $exception instanceof HttpExceptionInterface && $exception->getStatusCode() < 500 => self::error(
                ErrorCode::ValidationFailed,
                'The request could not be processed.',
                status: $exception->getStatusCode(),
                details: [],
                headers: $exception->getHeaders(),
            ),
            default => self::error(ErrorCode::InternalError, 'Something went wrong on our side. Please try again.'),
        };
    }

    private static function validation(ValidationException $exception): JsonResponse
    {
        $details = [];

        foreach ($exception->errors() as $key => $messages) {
            // Nested keys such as itemIds.0 are reported against the top-level field.
            $field = explode('.', (string) $key)[0];

            if (! isset($details[$field])) {
                $details[$field] = ['field' => $field, 'message' => (string) ($messages[0] ?? 'Invalid value.')];
            }
        }

        return self::error(ErrorCode::ValidationFailed, 'The given data was invalid.', details: array_values($details));
    }

    /**
     * @param  list<array{field: string, message: string}>|null  $details
     * @param  array<string, string|list<string>>  $headers
     */
    private static function error(
        ErrorCode $code,
        string $message,
        ?int $status = null,
        ?array $details = null,
        array $headers = [],
    ): JsonResponse {
        $error = ['code' => $code->value, 'message' => $message];

        if ($code === ErrorCode::ValidationFailed) {
            $error['details'] = $details ?? [];
        }

        return new JsonResponse(['error' => $error], $status ?? $code->status(), $headers);
    }
}
