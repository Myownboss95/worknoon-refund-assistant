<?php

declare(strict_types=1);

use App\Support\AdminTokenCheck;
use Psr\Log\AbstractLogger;

$strong = str_repeat('s', 32);

it('refuses to boot in production outside demo mode with a weak token, without printing it', function (string $token): void {
    $check = new AdminTokenCheck($token, demoMode: false, production: true);

    try {
        $check->enforce();
        $this->fail('Expected the check to throw');
    } catch (RuntimeException $exception) {
        expect($exception->getMessage())->toContain('ADMIN_TOKEN');

        if (strlen($token) > 0 && $token !== 'demo-admin') {
            expect($exception->getMessage())->not->toContain($token);
        }
    }
})->with([
    'missing' => [''],
    'demo token' => ['demo-admin'],
    'short' => [str_repeat('x', 31)],
]);

it('boots with a strong token, in demo mode, or outside production', function (string $token, bool $demoMode, bool $production): void {
    (new AdminTokenCheck($token, $demoMode, $production))->enforce();

    expect(true)->toBeTrue();
})->with([
    'strong token in production' => [$strong, false, true],
    'demo mode in production' => ['demo-admin', true, true],
    'local environment' => ['demo-admin', false, false],
]);

it('warns once in demo mode when the token is weak', function (string $token, bool $demoMode, int $warnings): void {
    $logger = new class extends AbstractLogger
    {
        /** @var list<string> */
        public array $warnings = [];

        public function log($level, Stringable|string $message, array $context = []): void
        {
            if ($level === 'warning') {
                $this->warnings[] = (string) $message;
            }
        }
    };

    (new AdminTokenCheck($token, $demoMode, production: true))->warn($logger);

    expect($logger->warnings)->toHaveCount($warnings);

    foreach ($logger->warnings as $warning) {
        expect($warning)->toContain('ADMIN_TOKEN')->not->toContain($token);
    }
})->with([
    'weak token in demo mode' => ['short-token', true, 1],
    'strong token in demo mode' => [$strong, true, 0],
    'weak token outside demo mode' => ['demo-admin', false, 0],
]);
