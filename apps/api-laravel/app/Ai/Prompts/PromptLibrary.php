<?php

declare(strict_types=1);

namespace App\Ai\Prompts;

use App\Data\ComposeInput;
use App\Data\ExtractionInput;
use App\Support\ContractFiles;

/**
 * Versioned system prompts (contracts/prompts/*.v1.md) and the user turns built around them.
 */
final readonly class PromptLibrary
{
    public const string EXTRACT_VERSION = 'extract.v1';

    public const string COMPOSE_VERSION = 'compose.v1';

    private const string MESSAGE_SEPARATOR = "\n---\n";

    public function __construct(
        public string $extractInstructions,
        public string $composeInstructions,
    ) {}

    public static function fromContracts(ContractFiles $contracts): self
    {
        return new self(
            extractInstructions: trim($contracts->text('prompts/'.self::EXTRACT_VERSION.'.md')),
            composeInstructions: trim($contracts->text('prompts/'.self::COMPOSE_VERSION.'.md')),
        );
    }

    /**
     * @return array{extract: string, compose: string}
     */
    public static function versions(): array
    {
        return ['extract' => self::EXTRACT_VERSION, 'compose' => self::COMPOSE_VERSION];
    }

    public function extractUserContent(ExtractionInput $input): string
    {
        $messages = array_map(self::escape(...), $input->customerMessages);

        return '<order_context>'.self::json($input->orderContext->toArray()).'</order_context>'."\n"
            .'<customer_message>'.implode(self::MESSAGE_SEPARATOR, $messages).'</customer_message>';
    }

    public function composeUserContent(ComposeInput $input): string
    {
        return '<decision>'.self::json($input->toArray()).'</decision>';
    }

    /**
     * Escape customer text placed inside <customer_message>: & first, then < and >, so no tag a
     * customer types can close or open a delimiter, whatever its nesting or spacing.
     */
    public static function escape(string $text): string
    {
        return str_replace(['&', '<', '>'], ['&amp;', '&lt;', '&gt;'], $text);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private static function json(array $data): string
    {
        return json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
}
