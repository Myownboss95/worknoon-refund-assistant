<?php

declare(strict_types=1);

namespace App\Ai;

use App\Ai\Agents\RefundExtractor;
use App\Ai\Agents\ReplyComposer;
use App\Ai\Contracts\RefundAnalyzer;
use App\Ai\Prompts\PromptLibrary;
use App\Data\AnalyzerResult;
use App\Data\ComposeInput;
use App\Data\Extraction;
use App\Data\ExtractionInput;
use App\Enums\AiErrorCode;
use App\Exceptions\AnalyzerFailed;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Laravel\Ai\Responses\AgentResponse;
use Laravel\Ai\Responses\StructuredAgentResponse;
use Throwable;

/**
 * Anthropic through laravel/ai. Extraction uses native structured output at temperature 0; the
 * output is validated again here because a schema-shaped reply can still be wrong.
 */
final readonly class ClaudeRefundAnalyzer implements RefundAnalyzer
{
    public function __construct(
        private PromptLibrary $prompts,
        private string $model,
        private int $timeoutSeconds,
    ) {}

    public function extract(ExtractionInput $input): AnalyzerResult
    {
        $response = $this->call(fn (): AgentResponse => (new RefundExtractor($this->prompts->extractInstructions))->prompt(
            $this->prompts->extractUserContent($input),
            model: $this->model,
            timeout: $this->timeoutSeconds,
        ));

        if (! $response instanceof StructuredAgentResponse) {
            throw new AnalyzerFailed(AiErrorCode::InvalidOutput);
        }

        return AnalyzerResult::extracted(
            Extraction::fromModelOutput($response->structured),
            $response->usage->inputTokens,
            $response->usage->outputTokens,
        );
    }

    public function compose(ComposeInput $input): AnalyzerResult
    {
        $response = $this->call(fn (): AgentResponse => (new ReplyComposer($this->prompts->composeInstructions))->prompt(
            $this->prompts->composeUserContent($input),
            model: $this->model,
            timeout: $this->timeoutSeconds,
        ));

        return AnalyzerResult::composed(
            trim($response->text),
            $response->usage->inputTokens,
            $response->usage->outputTokens,
        );
    }

    public function provider(): string
    {
        return 'anthropic';
    }

    public function model(): string
    {
        return $this->model;
    }

    /**
     * @param  Closure(): AgentResponse  $callback
     */
    private function call(Closure $callback): AgentResponse
    {
        try {
            return $callback();
        } catch (Throwable $exception) {
            throw new AnalyzerFailed(self::classify($exception), $exception);
        }
    }

    /**
     * Reduce any provider failure to a short code; the raw message never leaves this class.
     */
    private static function classify(Throwable $exception): AiErrorCode
    {
        for ($current = $exception; $current !== null; $current = $current->getPrevious()) {
            $message = strtolower($current->getMessage());

            if ($current instanceof ConnectionException
                && (str_contains($message, 'timed out') || str_contains($message, 'curl error 28'))) {
                return AiErrorCode::Timeout;
            }
        }

        return AiErrorCode::ProviderError;
    }
}
