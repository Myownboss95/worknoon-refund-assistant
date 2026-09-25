<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Domain\Refunds\Policy\PolicyConfig;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Http\JsonResponse;
use RuntimeException;

final class PolicyController
{
    public function __invoke(PolicyConfig $policy, Repository $config): JsonResponse
    {
        $path = (string) $config->get('refunds.policy_doc_path');
        $markdown = is_file($path) ? file_get_contents($path) : false;

        if ($markdown === false) {
            throw new RuntimeException('The policy document is missing.');
        }

        return new JsonResponse([
            'version' => $policy->version,
            'markdown' => $markdown,
            'config' => $config->get('refunds.policy'),
        ]);
    }
}
