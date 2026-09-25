<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Policy;

interface PolicyRule
{
    public function evaluate(PolicyContext $ctx): RuleResult;
}
