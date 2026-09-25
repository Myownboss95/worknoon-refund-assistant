import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        success: 'border-success/30 bg-success-soft text-success-strong',
        danger: 'border-danger/30 bg-danger-soft text-danger-strong',
        warning: 'border-warning/40 bg-warning-soft text-warning-strong',
        info: 'border-info-strong/20 bg-info-soft text-info-strong',
        accent: 'border-primary/25 bg-primary-soft text-primary dark:text-foreground',
        neutral: 'border-border bg-muted text-muted-foreground',
        outline: 'border-border bg-transparent text-foreground',
      },
      shape: {
        pill: 'rounded-full',
        chip: 'rounded-md font-mono text-[11px] tracking-tight',
      },
    },
    defaultVariants: { tone: 'neutral', shape: 'pill' },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { dot?: boolean };

const dotColor: Record<string, string> = {
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info-strong',
  accent: 'bg-primary',
  neutral: 'bg-muted-foreground',
  outline: 'bg-foreground',
};

export function Badge({ className, tone, shape, dot = false, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone, shape }), className)} {...props}>
      {dot && (
        <span
          aria-hidden="true"
          className={cn('size-1.5 rounded-full', dotColor[tone ?? 'neutral'])}
        />
      )}
      {children}
    </span>
  );
}
