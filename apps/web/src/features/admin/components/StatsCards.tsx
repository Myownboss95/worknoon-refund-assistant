import type { Stats } from '@worknoon/contracts';
import { CheckCircle2, Clock, Gauge, Inbox, Percent, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatPercent } from '@/shared/lib/formatMoney';
import { Card } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

interface StatItem {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
}

function buildItems(stats: Stats): StatItem[] {
  return [
    {
      label: 'Total requests',
      value: String(stats.total),
      hint: 'Created by the assistant',
      icon: Inbox,
      iconClass: 'bg-muted text-muted-foreground',
    },
    {
      label: 'Approved',
      value: String(stats.byStatus.approved),
      hint: 'Current status',
      icon: CheckCircle2,
      iconClass: 'bg-success-soft text-success-strong',
    },
    {
      label: 'Denied',
      value: String(stats.byStatus.denied),
      hint: 'Current status',
      icon: XCircle,
      iconClass: 'bg-danger-soft text-danger-strong',
    },
    {
      label: 'Escalated',
      value: String(stats.byStatus.escalated),
      hint: 'Pending human review',
      icon: Clock,
      iconClass: 'bg-warning-soft text-warning-strong',
    },
    {
      label: 'Escalation rate',
      value: formatPercent(stats.escalationRate),
      hint: `${stats.escalatedTotal} ever escalated · ${stats.humanReviewed} reviewed`,
      icon: Percent,
      iconClass: 'bg-info-soft text-info-strong',
    },
    {
      label: 'Auto-resolution',
      value: formatPercent(stats.autoResolutionRate),
      hint: 'Decided by policy alone',
      icon: Gauge,
      iconClass: 'bg-primary-soft text-primary dark:text-foreground',
    },
  ];
}

export function StatsCards({ stats, isLoading }: { stats: Stats | undefined; isLoading: boolean }) {
  if (isLoading || !stats) {
    return (
      <div
        className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
        aria-busy="true"
        aria-label="Loading statistics"
      >
        {Array.from({ length: 6 }, (_, index) => (
          <Card key={index} className="grid gap-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-24" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {buildItems(stats).map((item) => (
        <Card key={item.label} className="flex flex-col gap-1.5 p-4">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-xs font-medium text-muted-foreground">{item.label}</dt>
            <span
              className={cn('flex size-7 items-center justify-center rounded-md', item.iconClass)}
            >
              <item.icon className="size-3.5" aria-hidden="true" />
            </span>
          </div>
          <dd className="text-2xl font-semibold tabular-nums tracking-tight">{item.value}</dd>
          <dd className="text-[11px] leading-snug text-muted-foreground">{item.hint}</dd>
        </Card>
      ))}
    </dl>
  );
}
