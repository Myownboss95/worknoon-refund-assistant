<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Support;

use InvalidArgumentException;

/**
 * Renders the customer-facing templates from contracts/reply-templates.json.
 */
final readonly class TemplateRenderer
{
    /**
     * @param  array<string, string>  $templates
     */
    public function __construct(private array $templates) {}

    /**
     * @param  array<string, string>  $values  placeholder name (without braces) to value
     */
    public function render(string $template, array $values): string
    {
        if (! isset($this->templates[$template])) {
            throw new InvalidArgumentException("Unknown reply template [{$template}].");
        }

        $replacements = [];

        foreach ($values as $key => $value) {
            $replacements['{'.$key.'}'] = $value;
        }

        return trim(strtr($this->templates[$template], $replacements));
    }
}
