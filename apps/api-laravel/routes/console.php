<?php

declare(strict_types=1);

use App\Support\AdminTokenCheck;
use Illuminate\Support\Facades\Artisan;
use Psr\Log\LoggerInterface;

/*
| Run once by docker/entrypoint.sh when the container starts, so a weak ADMIN_TOKEN in production
| outside demo mode stops the container before it serves anything. HTTP requests enforce the same check
| in AppServiceProvider. It also logs the one-time warning for a weak token in demo mode, which would
| otherwise repeat on every request under FrankenPHP's classic mode.
*/
Artisan::command('refunds:check-admin-token', function (AdminTokenCheck $check, LoggerInterface $logger): int {
    $check->enforce();
    $check->warn($logger);

    return 0;
})->purpose('Check ADMIN_TOKEN and warn once when a weak token is used in demo mode');
