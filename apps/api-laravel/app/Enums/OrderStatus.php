<?php

declare(strict_types=1);

namespace App\Enums;

/**
 * Fulfilment status of an order.
 */
enum OrderStatus: string
{
    case Processing = 'processing';
    case Shipped = 'shipped';
    case Delivered = 'delivered';
}
