import { AlertTriangle, FileText, SlidersHorizontal } from 'lucide-react';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Skeleton } from '@/shared/ui/skeleton';
import { usePolicy } from './api';
import { PolicyMarkdown } from './components/PolicyMarkdown';
import { ThresholdsTable } from './components/ThresholdsTable';

export function PolicyPage() {
  const policy = usePolicy();

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-12 lg:py-8">
      <div className="lg:col-span-12">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Refund policy</h1>
          {policy.data && <Badge tone="accent">v{policy.data.version}</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          The rules the assistant enforces, served live by the selected backend.
        </p>
      </div>

      {policy.isError ? (
        <Card className="lg:col-span-12">
          <EmptyState
            icon={<AlertTriangle />}
            title="Couldn't load the policy"
            description={getErrorMessage(policy.error)}
          />
        </Card>
      ) : (
        <>
          <Card className="lg:col-span-8">
            <CardContent className="p-5 sm:p-8">
              {policy.isPending ? (
                <div className="grid gap-3" aria-busy="true" aria-label="Loading policy">
                  <Skeleton className="h-7 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-11/12" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="mt-4 h-40 w-full" />
                </div>
              ) : (
                <article aria-label="Policy document">
                  <PolicyMarkdown markdown={policy.data.markdown} />
                </article>
              )}
            </CardContent>
          </Card>

          <aside className="lg:col-span-4" aria-label="Policy thresholds">
            <div className="grid gap-4 lg:sticky lg:top-20">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal className="size-4 text-primary" aria-hidden="true" />
                    <CardTitle>Thresholds</CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Loaded from <span className="font-mono">policy.config.json</span>. Changing a
                    value changes the policy without touching rule code.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {policy.isPending ? (
                    <div className="grid gap-3">
                      {Array.from({ length: 6 }, (_, index) => (
                        <Skeleton key={index} className="h-6 w-full" />
                      ))}
                    </div>
                  ) : (
                    <ThresholdsTable config={policy.data.config} />
                  )}
                </CardContent>
              </Card>
              <Card className="bg-subtle">
                <CardContent className="flex gap-3 p-5 text-sm">
                  <FileText
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Rules decide. AI understands and explains.
                    </span>{' '}
                    The model never sets an amount or a decision; amounts always come from the
                    order.
                  </p>
                </CardContent>
              </Card>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
