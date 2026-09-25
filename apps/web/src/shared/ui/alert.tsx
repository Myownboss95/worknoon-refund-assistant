import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5',
  {
    variants: {
      tone: {
        neutral: 'bg-card text-card-foreground',
        danger: 'border-danger/30 bg-danger-soft text-danger-strong [&>svg]:text-danger',
        warning: 'border-warning/40 bg-warning-soft text-warning-strong',
        info: 'border-info-strong/20 bg-info-soft text-info-strong',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Alert({
  className,
  tone,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div data-slot="alert-title" className={cn('col-start-2 font-medium', className)} {...props} />
  );
}

export function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn('col-start-2 text-sm opacity-90', className)}
      {...props}
    />
  );
}
