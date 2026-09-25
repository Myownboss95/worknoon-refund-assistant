<?php

declare(strict_types=1);

namespace App\Support;

use RuntimeException;

/**
 * Reads the shared files in contracts/ (owned by the contract, never edited by the backends).
 */
final readonly class ContractFiles
{
    public function __construct(private string $basePath) {}

    /**
     * @return array<string, mixed>
     */
    public function json(string $file): array
    {
        $decoded = json_decode($this->text($file), true, 512, JSON_THROW_ON_ERROR);

        if (! is_array($decoded)) {
            throw new RuntimeException("Contract file [{$file}] must contain a JSON object.");
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }

    public function text(string $file): string
    {
        $path = $this->basePath.'/'.ltrim($file, '/');

        if (! is_file($path) || ($contents = file_get_contents($path)) === false) {
            throw new RuntimeException("Contract file [{$file}] is missing from {$this->basePath}.");
        }

        return $contents;
    }
}
