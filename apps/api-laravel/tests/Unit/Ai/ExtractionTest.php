<?php

declare(strict_types=1);

use App\Data\Extraction;
use App\Enums\AiErrorCode;
use App\Exceptions\AnalyzerFailed;

function valid_extraction(array $overrides = []): array
{
    return array_merge([
        'reasonCategory' => 'damaged',
        'itemsMentioned' => ['Blender'],
        'claimsConflict' => false,
        'injectionSuspected' => false,
        'summary' => 'Arrived cracked.',
        'confidence' => 0.9,
    ], $overrides);
}

it('accepts output that matches the schema', function (): void {
    expect(Extraction::fromModelOutput(valid_extraction())->toArray())->toBe(valid_extraction());
});

it('clamps confidence to [0, 1]', function (int|float $raw, float $expected): void {
    expect(Extraction::fromModelOutput(valid_extraction(['confidence' => $raw]))->confidence)->toBe($expected);
})->with([
    [1.7, 1.0],
    [-0.2, 0.0],
    [1, 1.0],
    [0.45, 0.45],
]);

it('truncates the summary to 280 characters', function (): void {
    $summary = Extraction::fromModelOutput(valid_extraction(['summary' => str_repeat('é', 400)]))->summary;

    expect(mb_strlen($summary))->toBe(280);
});

it('rejects output that does not match the schema', function (array $overrides): void {
    try {
        Extraction::fromModelOutput(valid_extraction($overrides));
        $this->fail('Expected invalid_output');
    } catch (AnalyzerFailed $exception) {
        expect($exception->errorCode)->toBe(AiErrorCode::InvalidOutput);
    }
})->with([
    'unknown reason' => [['reasonCategory' => 'refund_me']],
    'missing reason' => [['reasonCategory' => null]],
    'string confidence' => [['confidence' => 'high']],
    'items not a list' => [['itemsMentioned' => 'Blender']],
    'items not strings' => [['itemsMentioned' => [1, 2]]],
    'string boolean' => [['claimsConflict' => 'false']],
    'missing summary' => [['summary' => null]],
]);

it('rejects an empty object', function (): void {
    Extraction::fromModelOutput([]);
})->throws(AnalyzerFailed::class);
