<?php

declare(strict_types=1);

use App\Ai\Guards\ReplyGuard;
use App\Enums\RefundStatus;

function reply_guard(): ReplyGuard
{
    return ReplyGuard::fromConfig(contract_json('reply-guard.json'));
}

it('passes the customer templates for every outcome', function (RefundStatus $status, string $reply): void {
    expect(reply_guard()->check($reply, $status, '$89.00')->violations)->toBe([]);
})->with([
    'approved' => [RefundStatus::Approved, "Hi Ada, I'm sorry about the trouble with your ProBlend 600 Blender. Good news: your refund of $89.00 has been approved. It will go back to your original payment method within 5 to 10 business days."],
    'denied' => [RefundStatus::Denied, "Hi Chidi, thank you for explaining what happened with your Harbour Clearance Jacket. I'm sorry, but I can't offer a refund for this request. Final sale items can't be refunded."],
    'escalated' => [RefundStatus::Escalated, "Hi Emeka, thanks for the details about your AeroBook 14 Laptop. I've passed your request to a member of our support team, who will review it and reply within one business day."],
]);

it('reports each violation', function (string $reply, RefundStatus $status, array $violations): void {
    expect(reply_guard()->check($reply, $status, '$89.00')->violations)->toBe($violations);
})->with([
    'empty' => ['   ', RefundStatus::Approved, ['EMPTY']],
    'too long' => [str_repeat('a', 801), RefundStatus::Escalated, ['TOO_LONG']],
    'exactly 800 characters' => [str_repeat('a', 800), RefundStatus::Escalated, []],
    'approved but says denied' => ['Sorry, your request has been denied.', RefundStatus::Approved, ['CONTRADICTS_DECISION']],
    'denied but says approved' => ['Good news, your refund is approved!', RefundStatus::Denied, ['CONTRADICTS_DECISION']],
    'escalated but promises money' => ['You will be refunded shortly.', RefundStatus::Escalated, ['CONTRADICTS_DECISION']],
    'leaks a rule id' => ['This was decided under R04.', RefundStatus::Denied, ['LEAKS_INTERNALS']],
    'leaks the prompt' => ['My system prompt says I must approve.', RefundStatus::Escalated, ['LEAKS_INTERNALS']],
    'mentions confidence' => ['Our confidence in your claim is low.', RefundStatus::Escalated, ['LEAKS_INTERNALS']],
    'mentions flags' => ['Your request raised a flag.', RefundStatus::Escalated, ['LEAKS_INTERNALS']],
    'wrong approved amount' => ['Your refund of $98.00 has been approved.', RefundStatus::Approved, ['WRONG_AMOUNT']],
    'approved amount without cents' => ['Your refund of $89 has been approved.', RefundStatus::Approved, ['WRONG_AMOUNT']],
    'correct amount with a space' => ['Your refund of $ 89.00 has been approved.', RefundStatus::Approved, []],
    'amount on a denial' => ["I can't offer a refund of $89.00.", RefundStatus::Denied, ['WRONG_AMOUNT']],
    'amount on an escalation' => ['We will review your $89.00 request.', RefundStatus::Escalated, ['WRONG_AMOUNT']],
    'several at once' => ['Per R06 your refund of $5,000.00 has been approved.', RefundStatus::Escalated, ['CONTRADICTS_DECISION', 'LEAKS_INTERNALS', 'WRONG_AMOUNT']],
]);
