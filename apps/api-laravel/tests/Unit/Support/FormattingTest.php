<?php

declare(strict_types=1);

use App\Domain\Refunds\Support\EmailMask;
use App\Domain\Refunds\Support\ItemRefundState;
use App\Domain\Refunds\Support\Money;
use App\Domain\Refunds\Support\Names;
use App\Domain\Refunds\Support\TemplateRenderer;
use App\Enums\RefundStatus;

it('formats cents as dollars', function (int $cents, string $expected): void {
    expect(Money::format($cents))->toBe($expected);
})->with([
    [129900, '$1,299.00'],
    [8900, '$89.00'],
    [5, '$0.05'],
    [0, '$0.00'],
    [50001, '$500.01'],
    [123456789, '$1,234,567.89'],
]);

it('joins item names', function (array $names, string $expected): void {
    expect(Names::join($names))->toBe($expected);
})->with([
    [[], ''],
    [['A'], 'A'],
    [['A', 'B'], 'A and B'],
    [['A', 'B', 'C'], 'A, B and C'],
    [['A', 'B', 'C', 'D'], 'A, B, C and D'],
]);

it('takes the first name', function (string $name, string $expected): void {
    expect(Names::firstName($name))->toBe($expected);
})->with([
    ['Ada Okafor', 'Ada'],
    ['Cher', 'Cher'],
    ['Mary Jane Watson', 'Mary'],
]);

it('masks emails', function (string $email, string $expected): void {
    expect(EmailMask::mask($email))->toBe($expected);
})->with([
    ['ada.okafor@example.com', 'a***@example.com'],
    ['x@example.org', 'x***@example.org'],
    ['not-an-email', '***'],
]);

it('derives an item refund state', function (array $statuses, ?string $expected): void {
    expect(ItemRefundState::from($statuses))->toBe($expected);
})->with([
    'no requests' => [[], null],
    'denied only' => [[RefundStatus::Denied], null],
    'escalated' => [[RefundStatus::Denied, RefundStatus::Escalated], 'pending'],
    'approved wins' => [[RefundStatus::Escalated, RefundStatus::Approved], 'approved'],
]);

it('renders reply templates from the contract', function (): void {
    $templates = new TemplateRenderer(array_filter(contract_json('reply-templates.json'), 'is_string'));

    expect($templates->render('greeting', ['firstName' => 'Ada', 'orderNumber' => 'WN-1001']))
        ->toBe('Hi Ada, thanks for verifying your order WN-1001. Select the item or items this is about, then tell me what went wrong.');
});

it('rejects unknown templates', function (): void {
    (new TemplateRenderer([]))->render('nope', []);
})->throws(InvalidArgumentException::class);
