#!/bin/sh
# Boot the API: key, caches, schema, seed (idempotent), then serve on :3002.
set -eu

cd /app

if [ -z "${APP_KEY:-}" ]; then
    # No key supplied: generate one in memory for this container's lifetime. Nothing is encrypted
    # at rest, so a per-boot key is safe; set LARAVEL_APP_KEY to pin one.
    APP_KEY="base64:$(head -c 32 /dev/urandom | base64)"
    export APP_KEY
fi

php artisan config:cache --no-ansi
# Refuses to start with a weak ADMIN_TOKEN outside demo mode; warns once when weak in demo mode.
php artisan refunds:check-admin-token --no-ansi
php artisan route:cache --no-ansi
php artisan event:cache --no-ansi

php artisan migrate --force --no-ansi
php artisan db:seed --force --no-ansi

exec frankenphp php-server --root /app/public --listen :3002
