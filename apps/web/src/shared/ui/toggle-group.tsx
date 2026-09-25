import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

/** Segmented control built on Radix ToggleGroup (single selection). */
export function SegmentedControl({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="segmented-control"
      className={cn('inline-flex items-center rounded-lg border bg-muted p-0.5', className)}
      {...props}
    />
  );
}

export function SegmentedControlItem({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={cn(
        'inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none sm:px-3',
        'hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        'data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm',
        className,
      )}
      {...props}
    />
  );
}
