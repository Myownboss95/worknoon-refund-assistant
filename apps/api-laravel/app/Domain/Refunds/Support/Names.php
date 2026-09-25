<?php

declare(strict_types=1);

namespace App\Domain\Refunds\Support;

final class Names
{
    /**
     * `A`, `A and B`, `A, B and C`.
     *
     * @param  list<string>  $names
     */
    public static function join(array $names): string
    {
        $count = count($names);

        if ($count <= 1) {
            return $names[0] ?? '';
        }

        $last = array_pop($names);

        return implode(', ', $names).' and '.$last;
    }

    /**
     * The text before the first space.
     */
    public static function firstName(string $name): string
    {
        $name = trim($name);
        $space = strpos($name, ' ');

        return $space === false ? $name : substr($name, 0, $space);
    }
}
