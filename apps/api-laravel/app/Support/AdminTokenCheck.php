<?php

declare(strict_types=1);

namespace App\Support;

use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * Boot-time check of ADMIN_TOKEN (docs/pipeline.md, Hardening). Outside demo mode a production app
 * refuses to start with a missing, well-known or short token. Messages name the variable, never
 * its value.
 */
final readonly class AdminTokenCheck
{
    public const string DEMO_TOKEN = 'demo-admin';

    public const int MIN_LENGTH = 32;

    public function __construct(
        private string $token,
        private bool $demoMode,
        private bool $production,
    ) {}

    public function isWeak(): bool
    {
        return $this->token === '' || $this->token === self::DEMO_TOKEN || strlen($this->token) < self::MIN_LENGTH;
    }

    /**
     * @throws RuntimeException in production outside demo mode when the token is weak
     */
    public function enforce(): void
    {
        if ($this->production && ! $this->demoMode && $this->isWeak()) {
            throw new RuntimeException(sprintf(
                'ADMIN_TOKEN must be set, must not be "%s" and must be at least %d characters when DEMO_MODE is false in production.',
                self::DEMO_TOKEN,
                self::MIN_LENGTH,
            ));
        }
    }

    /**
     * In demo mode a weak token is allowed, but said out loud once.
     */
    public function warn(LoggerInterface $logger): void
    {
        if ($this->demoMode && $this->isWeak()) {
            $logger->warning('ADMIN_TOKEN is weak (missing, demo-admin or shorter than '.self::MIN_LENGTH.' characters); acceptable only because DEMO_MODE is true.');
        }
    }
}
