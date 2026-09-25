# syntax=docker/dockerfile:1.7
#
# Worknoon Refund Assistant: Laravel API.
# Build context is the repository root (see docker-compose.yml, service api-laravel):
#   docker compose build api-laravel

ARG PHP_IMAGE=dunglas/frankenphp:1-php8.4-alpine

# --- Base: PHP 8.4 on FrankenPHP with the extensions the app needs -------------------------------
FROM ${PHP_IMAGE} AS base

RUN install-php-extensions pdo_pgsql intl opcache bcmath \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY apps/api-laravel/docker/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"

WORKDIR /app

# --- Vendor: production dependencies only ---------------------------------------------------------
FROM base AS vendor

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY apps/api-laravel/composer.json apps/api-laravel/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --no-interaction --no-progress --prefer-dist

COPY apps/api-laravel/ ./
# APP_ENV=build: no ADMIN_TOKEN exists at build time, so skip the production boot check.
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative --no-scripts \
    && APP_ENV=build php artisan package:discover --ansi

# --- Runtime ---------------------------------------------------------------------------------------
FROM base AS runtime

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    CACHE_STORE=database \
    SESSION_DRIVER=array \
    CONTRACTS_PATH=/srv/contracts \
    POLICY_DOC_PATH=/srv/policy/refund-policy.md \
    XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data

# The shared contract (policy config, fixtures, templates, prompts) and the policy document.
COPY contracts/ /srv/contracts/
COPY policy/ /srv/policy/

COPY --from=vendor /app /app
COPY apps/api-laravel/docker/entrypoint.sh /usr/local/bin/entrypoint

RUN adduser -D -H -u 10001 app \
    && mkdir -p storage/framework/cache storage/framework/views storage/logs bootstrap/cache \
    && chown -R app:app storage bootstrap/cache /config /data \
    && chmod +x /usr/local/bin/entrypoint

USER app

EXPOSE 3002

HEALTHCHECK --interval=5s --timeout=3s --retries=30 \
    CMD wget -qO- http://127.0.0.1:3002/api/v1/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint"]
