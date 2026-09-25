<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\Admin\RefundRequestController;
use App\Http\Controllers\Api\V1\Admin\ResetDemoController;
use App\Http\Controllers\Api\V1\Admin\ReviewRefundRequestController;
use App\Http\Controllers\Api\V1\Admin\StatsController;
use App\Http\Controllers\Api\V1\ConversationController;
use App\Http\Controllers\Api\V1\ConversationMessageController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\PolicyController;
use App\Http\Controllers\Api\V1\VerifyCustomerController;
use App\Http\Middleware\EnsureAdminToken;
use App\Http\Middleware\EnsureConversationOpen;
use Illuminate\Support\Facades\Route;

/*
| All routes are served under /api/v1 (see bootstrap/app.php). Ids are UUIDs; anything else is a 404.
*/

Route::get('health', HealthController::class)->name('health');
Route::get('policy', PolicyController::class)->name('policy.show');

Route::post('customers/verify', VerifyCustomerController::class)
    ->middleware('throttle:verify')
    ->name('customers.verify');

Route::get('conversations/{conversation}', [ConversationController::class, 'show'])
    ->whereUuid('conversation')
    ->name('conversations.show');

Route::post('conversations/{conversation}/messages', [ConversationMessageController::class, 'store'])
    ->whereUuid('conversation')
    ->middleware(['throttle:messages', EnsureConversationOpen::class])
    ->name('conversations.messages.store');

Route::prefix('admin')
    ->name('admin.')
    ->middleware(EnsureAdminToken::class)
    ->group(function (): void {
        Route::get('refund-requests', [RefundRequestController::class, 'index'])
            ->name('refund-requests.index');

        Route::get('refund-requests/{refundRequest}', [RefundRequestController::class, 'show'])
            ->whereUuid('refundRequest')
            ->name('refund-requests.show');

        Route::post('refund-requests/{refundRequest}/review', ReviewRefundRequestController::class)
            ->whereUuid('refundRequest')
            ->name('refund-requests.review');

        Route::get('stats', StatsController::class)->name('stats');

        Route::post('demo/reset', ResetDemoController::class)->name('demo.reset');
    });
