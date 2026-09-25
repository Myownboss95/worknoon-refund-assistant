# Refund Assistant API: Laravel 13

The Laravel implementation of the Worknoon Refund Assistant API. It implements
[`contracts/openapi.yaml`](../../contracts/openapi.yaml) and [`docs/pipeline.md`](../../docs/pipeline.md);
see the [root README](../../README.md) for the full picture.

## Where things live

| Path | What |
|---|---|
| `app/Actions/HandleRefundMessage.php` | The refund pipeline (one customer turn) |
| `app/Domain/Refunds/Policy/` | Pure policy engine, one class per rule (`Rules/R01…R10`) |
| `app/Ai/` | `RefundAnalyzer` contract, Claude (`laravel/ai`) and Mock analyzers, injection detector, reply guard |
| `app/Http/` | Thin controllers, FormRequests, API Resources, admin token middleware |
| `config/refunds.php` | Reads env and `contracts/policy.config.json` |
| `database/seeders/ScenarioSeeder.php` | Seeds from `contracts/scenarios.json` |

## Local development

```bash
docker compose up -d db            # from the repo root; Postgres on localhost:55432
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve --port=3002      # http://localhost:3002/api/v1/health
```

## Checks

```bash
composer test      # Pest (uses the refunds_laravel_test database)
composer lint      # Pint
composer analyse   # Larastan level 8
```
