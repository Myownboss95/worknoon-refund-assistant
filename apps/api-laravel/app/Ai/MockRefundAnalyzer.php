<?php

declare(strict_types=1);

namespace App\Ai;

use App\Ai\Contracts\RefundAnalyzer;
use App\Data\AnalyzerResult;
use App\Data\ComposeInput;
use App\Data\Extraction;
use App\Data\ExtractionInput;
use App\Domain\Refunds\Support\Names;
use App\Domain\Refunds\Support\TemplateRenderer;
use App\Enums\AiErrorCode;
use App\Enums\RefundStatus;
use App\Exceptions\AnalyzerFailed;

/**
 * Deterministic stand-in for the model (contracts/mock-llm-fixtures.json): lowercase the latest
 * customer message, first fixture with a matching `anyOf` substring wins, else `extractDefault`.
 * Compose renders contracts/reply-templates.json.
 */
final readonly class MockRefundAnalyzer implements RefundAnalyzer
{
    /**
     * @param  list<array{id: string, anyOf: list<string>, error?: string, extraction?: array<string, mixed>}>  $fixtures
     * @param  array<string, mixed>  $defaultExtraction
     */
    public function __construct(
        private array $fixtures,
        private array $defaultExtraction,
        private TemplateRenderer $templates,
        private string $model = 'mock',
    ) {}

    /**
     * @param  array<string, mixed>  $fixtureFile  the decoded mock-llm-fixtures.json
     */
    public static function fromFixtures(array $fixtureFile, TemplateRenderer $templates): self
    {
        /** @var list<array{id: string, anyOf: list<string>, error?: string, extraction?: array<string, mixed>}> $fixtures */
        $fixtures = is_array($fixtureFile['extract'] ?? null) ? array_values($fixtureFile['extract']) : [];

        /** @var array<string, mixed> $default */
        $default = is_array($fixtureFile['extractDefault'] ?? null) ? $fixtureFile['extractDefault'] : [];

        $model = is_string($fixtureFile['model'] ?? null) ? $fixtureFile['model'] : 'mock';

        return new self($fixtures, $default, $templates, $model);
    }

    public function extract(ExtractionInput $input): AnalyzerResult
    {
        $latest = mb_strtolower($input->latestMessage);

        foreach ($this->fixtures as $fixture) {
            if (! $this->matches($latest, $fixture['anyOf'])) {
                continue;
            }

            if (isset($fixture['error'])) {
                throw new AnalyzerFailed(AiErrorCode::tryFrom($fixture['error']) ?? AiErrorCode::ProviderError);
            }

            return AnalyzerResult::extracted(Extraction::fromModelOutput($fixture['extraction'] ?? []));
        }

        return AnalyzerResult::extracted(Extraction::fromModelOutput($this->defaultExtraction));
    }

    public function compose(ComposeInput $input): AnalyzerResult
    {
        return AnalyzerResult::composed($this->templates->render($input->outcome->value, [
            'firstName' => $input->firstName,
            'itemNames' => Names::join($input->itemNames),
            'amount' => $input->amount,
            'customerReason' => $input->outcome === RefundStatus::Denied ? implode(' ', $input->customerReasons) : '',
        ]));
    }

    public function provider(): string
    {
        return 'mock';
    }

    public function model(): string
    {
        return $this->model;
    }

    /**
     * @param  list<string>  $needles
     */
    private function matches(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if (str_contains($haystack, mb_strtolower($needle))) {
                return true;
            }
        }

        return false;
    }
}
