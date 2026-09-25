import type { Decision } from '@worknoon/contracts';
import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { formatMoney } from '@/shared/lib/formatMoney';
import { refundStatusMap } from '@/shared/lib/statusMap';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

const presentation = {
  approved: {
    icon: CheckCircle2,
    title: 'Refund approved',
    frame: 'border-success/40 bg-success-soft/60',
    iconClass: 'bg-success text-white dark:text-background',
  },
  denied: {
    icon: XCircle,
    title: 'Refund not approved',
    frame: 'border-danger/35 bg-danger-soft/60',
    iconClass: 'bg-danger text-white dark:text-background',
  },
  escalated: {
    icon: Clock,
    title: 'Sent for human review',
    frame: 'border-warning/50 bg-warning-soft/70',
    iconClass: 'bg-warning text-black/80',
  },
} as const;

export interface DecisionCardProps {
  decision: Decision;
  onStartOver: () => void;
}

export function DecisionCard({ decision, onStartOver }: DecisionCardProps) {
  const view = presentation[decision.status];
  const meta = refundStatusMap[decision.status];
  const Icon = view.icon;

  return (
    <section
      aria-labelledby="decision-title"
      data-testid="decision-card"
      className={cn('rounded-xl border p-4 sm:p-5', view.frame)}
    >
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            view.iconClass,
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 id="decision-title" className="text-base font-semibold">
              {view.title}
            </h3>
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          </div>
          <p className="text-sm">{decision.customerReason}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Refund amount</p>
          <p className="text-xl font-semibold tabular-nums">{formatMoney(decision.amountCents)}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-current/10 pt-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>
            Decided by {decision.decidedBy === 'human' ? 'our support team' : 'refund policy'}
          </span>
          {decision.decisiveRuleIds.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>Rules</span>
              <ul className="flex flex-wrap gap-1" aria-label="Decisive policy rules">
                {decision.decisiveRuleIds.map((ruleId) => (
                  <li key={ruleId}>
                    <Badge shape="chip" tone="outline">
                      {ruleId}
                    </Badge>
                  </li>
                ))}
              </ul>
              <Link to="/policy" className="ml-1 underline-offset-2 hover:underline">
                What do these mean?
              </Link>
            </>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onStartOver}>
          <RotateCcw aria-hidden="true" />
          Start over
        </Button>
      </div>
    </section>
  );
}
