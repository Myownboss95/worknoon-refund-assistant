<?php

declare(strict_types=1);

namespace App\Ai\Contracts;

use App\Data\AnalyzerResult;
use App\Data\ComposeInput;
use App\Data\ExtractionInput;
use App\Exceptions\AnalyzerFailed;

/**
 * The only two things the language model is allowed to do: turn the customer's words into
 * structured signals, and word a decision that has already been made.
 */
interface RefundAnalyzer
{
    /**
     * @throws AnalyzerFailed
     */
    public function extract(ExtractionInput $input): AnalyzerResult;

    /**
     * @throws AnalyzerFailed
     */
    public function compose(ComposeInput $input): AnalyzerResult;

    /**
     * `mock` or `anthropic`, as reported by health and the decision trace.
     */
    public function provider(): string;

    public function model(): string;
}
