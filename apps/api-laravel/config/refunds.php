<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Refund assistant
|--------------------------------------------------------------------------
|
| Everything the refund pipeline reads from the environment lives here. The
| shared contract files (policy thresholds, fixtures, templates, prompts)
| are owned by contracts/ at the repository root and are read at boot, so
| both backends enforce exactly the same policy.
|
*/

$contractsPath = rtrim((string) env('CONTRACTS_PATH', base_path('../../contracts')), '/');

$policyConfigFile = $contractsPath.'/policy.config.json';

$policy = is_file($policyConfigFile)
    ? json_decode((string) file_get_contents($policyConfigFile), true, 512, JSON_THROW_ON_ERROR)
    : [];

$provider = strtolower((string) env('LLM_PROVIDER', 'mock'));
$anthropicKey = (string) env('ANTHROPIC_API_KEY', '');

return [

    'backend' => 'laravel',

    'contracts_path' => $contractsPath,

    'policy_doc_path' => (string) env('POLICY_DOC_PATH', base_path('../../policy/refund-policy.md')),

    // The parsed contents of contracts/policy.config.json, without "$comment" keys.
    'policy' => array_filter(
        is_array($policy) ? $policy : [],
        static fn (string $key): bool => ! str_starts_with($key, '$'),
        ARRAY_FILTER_USE_KEY,
    ),

    // Enables POST /admin/demo/reset and tolerates the well-known demo admin token.
    'demo_mode' => filter_var(env('DEMO_MODE', false), FILTER_VALIDATE_BOOLEAN),

    'admin_token' => (string) env('ADMIN_TOKEN', 'demo-admin'),

    // IPs/CIDRs whose X-Forwarded-For is honoured. Empty trusts none: the socket address is the client.
    'trusted_proxies' => array_values(array_filter(
        array_map(trim(...), explode(',', (string) env('TRUSTED_PROXIES', ''))),
        static fn (string $proxy): bool => $proxy !== '',
    )),

    'rate_limits' => [
        'verify_per_minute' => (int) env('RATE_LIMIT_VERIFY_PER_MINUTE', 60),
        'messages_per_minute' => (int) env('RATE_LIMIT_MESSAGES_PER_MINUTE', 60),
        'admin_failures_per_minute' => (int) env('RATE_LIMIT_ADMIN_FAILURES_PER_MINUTE', 20),
        'conversations_per_order_per_day' => (int) env('MAX_CONVERSATIONS_PER_ORDER_PER_DAY', 20),
    ],

    'llm' => [
        // "anthropic" only when a key is present; anything else runs the deterministic mock.
        'provider' => $provider === 'anthropic' && $anthropicKey !== '' ? 'anthropic' : 'mock',
        'model' => (string) env('LLM_MODEL', 'claude-haiku-4-5'),
        'timeout_seconds' => 20,
        'max_attempts' => 2,
        // Global budget of real provider calls (every extract and compose attempt) per rolling hour.
        'max_calls_per_hour' => (int) env('LLM_MAX_CALLS_PER_HOUR', 1000),
    ],

];
