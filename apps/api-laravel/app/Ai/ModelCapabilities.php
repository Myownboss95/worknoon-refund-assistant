<?php

declare(strict_types=1);

namespace App\Ai;

/**
 * Models released after Claude Opus 4.6 reject any temperature other than 1.0, so a temperature is
 * only sent to the model families that still accept it (same rule as the Nest backend).
 */
final class ModelCapabilities
{
    private const string ACCEPTS_TEMPERATURE = '/^claude-(3|(haiku|sonnet|opus)-4-[0-6](-|$))/';

    public static function acceptsTemperature(string $model): bool
    {
        return preg_match(self::ACCEPTS_TEMPERATURE, $model) === 1;
    }

    /**
     * The given temperature when the model accepts one, otherwise null (the parameter is omitted).
     */
    public static function temperature(string $model, float $temperature): ?float
    {
        return self::acceptsTemperature($model) ? $temperature : null;
    }
}
