import type { Order } from '@worknoon/contracts';
import { Package } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';
import { itemRefundStatusMap, orderStatusMap } from '@/shared/lib/statusMap';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';

export interface OrderCardProps {
  order: Order;
  customerName: string;
  selectedItemIds: string[];
  onToggleItem: (itemId: string, selected: boolean) => void;
  /** When the conversation is closed the selection is read-only. */
  disabled?: boolean;
}

export function OrderCard({
  order,
  customerName,
  selectedItemIds,
  onToggleItem,
  disabled = false,
}: OrderCardProps) {
  const id = useId();
  const status = orderStatusMap[order.status];
  const selectedTotal = order.items
    .filter((item) => selectedItemIds.includes(item.id))
    .reduce((sum, item) => sum + item.lineTotalCents, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b bg-subtle px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground">
            <Package className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Order <span className="font-mono">{order.orderNumber}</span>
            </h2>
            <p className="text-xs text-muted-foreground">{customerName}</p>
          </div>
        </div>
        <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <dt className="sr-only">Status</dt>
            <dd>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Placed</dt>
            <dd className="font-medium">{formatDate(order.placedAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Delivered</dt>
            <dd className="font-medium">
              {order.deliveredAt ? formatDate(order.deliveredAt) : 'Not yet'}
            </dd>
          </div>
        </dl>
      </div>

      <fieldset disabled={disabled} className="px-2 py-2 sm:px-3">
        <legend className="sr-only">Select the items you want refunded</legend>
        <p
          id={`${id}-hint`}
          className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {disabled ? 'Items' : 'Select the items for your request'}
        </p>
        <ul className="grid gap-0.5">
          {order.items.map((item) => {
            const inputId = `${id}-${item.id}`;
            const blocked = item.refundStatus !== null;
            const refund = item.refundStatus ? itemRefundStatusMap[item.refundStatus] : null;
            const checked = selectedItemIds.includes(item.id);
            return (
              <li key={item.id}>
                <label
                  htmlFor={inputId}
                  className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors',
                    blocked || disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-accent',
                    checked && !disabled && 'bg-primary-soft/60 hover:bg-primary-soft',
                    blocked && 'opacity-70',
                  )}
                >
                  <Checkbox
                    id={inputId}
                    className="mt-0.5"
                    checked={checked}
                    disabled={blocked || disabled}
                    onCheckedChange={(value) => onToggleItem(item.id, value === true)}
                    aria-describedby={`${id}-hint`}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      {item.finalSale && (
                        <Badge tone="neutral" className="uppercase tracking-wide text-[10px]">
                          Final sale
                        </Badge>
                      )}
                      {refund && (
                        <Badge tone={refund.tone} dot>
                          {refund.label}
                        </Badge>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <span className="font-mono">{item.sku}</span>
                      <span aria-hidden="true"> · </span>
                      Qty {item.quantity} × {formatMoney(item.unitPriceCents)}
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums">
                    {formatMoney(item.lineTotalCents)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
        <span className="text-muted-foreground">
          {selectedItemIds.length > 0
            ? `${selectedItemIds.length} item${selectedItemIds.length === 1 ? '' : 's'} selected`
            : `Order total`}
        </span>
        <span className="font-semibold tabular-nums">
          {formatMoney(selectedItemIds.length > 0 ? selectedTotal : order.totalCents)}
        </span>
      </div>
    </Card>
  );
}
