import { BookOpen, FlaskConical } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { refundStatusMap } from '@/shared/lib/statusMap';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import type { DemoScenario } from '../hooks/useScenarios';

export interface ScenarioPanelProps {
  scenarios: DemoScenario[];
  activeScenarioId: number | null;
  onSelect: (scenario: DemoScenario) => void;
}

export function ScenarioPanel({ scenarios, activeScenarioId, onSelect }: ScenarioPanelProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-subtle pb-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-primary" aria-hidden="true" />
          <CardTitle id="scenario-panel-title">Demo scenarios</CardTitle>
        </div>
        <CardDescription className="text-xs">
          Pick a scenario to prefill the customer&apos;s details. Each one exercises a different
          policy rule.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul
          aria-labelledby="scenario-panel-title"
          className="max-h-[32rem] divide-y overflow-y-auto lg:max-h-[calc(100dvh-16rem)]"
        >
          {scenarios.map((scenario) => {
            const active = scenario.id === activeScenarioId;
            const expected = refundStatusMap[scenario.expectedStatus];
            return (
              <li key={scenario.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(scenario)}
                  className={cn(
                    'group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none',
                    'hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:ring-inset',
                    active && 'bg-primary-soft hover:bg-primary-soft',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card font-mono text-[11px] font-semibold text-muted-foreground',
                      active && 'border-primary bg-primary text-primary-foreground',
                    )}
                  >
                    {scenario.id}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{scenario.customerName}</span>
                      <Badge tone={expected.tone} className="shrink-0">
                        <span className="sr-only">Expected outcome: </span>
                        {expected.label}
                      </Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">{scenario.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="border-t px-4 py-3">
          <Link
            to="/policy"
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:text-foreground"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            View refund policy
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
