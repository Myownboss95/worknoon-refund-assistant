<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| laravel/ai
|--------------------------------------------------------------------------
|
| Only Anthropic is used. Whether the real provider runs at all is decided
| by config/refunds.php (LLM_PROVIDER, falling back to the mock when no
| API key is set); this file only configures the provider itself.
|
*/

return [

    'default' => 'anthropic',

    'caching' => [
        'embeddings' => [
            'cache' => false,
            'store' => env('CACHE_STORE', 'database'),
            'individually' => true,
        ],
    ],

    'providers' => [
        'anthropic' => [
            'driver' => 'anthropic',
            'key' => env('ANTHROPIC_API_KEY'),
            'url' => env('ANTHROPIC_URL', 'https://api.anthropic.com/v1'),
        ],
    ],

];
