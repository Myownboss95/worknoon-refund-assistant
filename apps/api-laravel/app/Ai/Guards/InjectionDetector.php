<?php

declare(strict_types=1);

namespace App\Ai\Guards;

use InvalidArgumentException;

/**
 * Heuristic prompt-injection detector (contracts/injection-patterns.json). Runs on every customer
 * message before, and independently of, the model.
 */
final readonly class InjectionDetector
{
    /**
     * @param  array<string, string>  $patterns  pattern id to compiled PCRE
     */
    private function __construct(private array $patterns) {}

    /**
     * @param  list<array{id: string, pattern: string}>  $definitions
     */
    public static function fromDefinitions(array $definitions): self
    {
        $patterns = [];

        foreach ($definitions as $definition) {
            // Case-insensitive and multiline, as the contract requires; UTF-8 aware.
            $regex = '~'.$definition['pattern'].'~imu';

            if (@preg_match($regex, '') === false) {
                throw new InvalidArgumentException("Invalid injection pattern [{$definition['id']}].");
            }

            $patterns[$definition['id']] = $regex;
        }

        return new self($patterns);
    }

    /**
     * Ids of every pattern that matches any of the messages, sorted and unique.
     *
     * @param  list<string>  $messages
     * @return list<string>
     */
    public function detect(array $messages): array
    {
        $matches = [];

        foreach ($this->patterns as $id => $regex) {
            foreach ($messages as $message) {
                if (preg_match($regex, $message) === 1) {
                    $matches[] = $id;

                    break;
                }
            }
        }

        sort($matches, SORT_STRING);

        return $matches;
    }
}
