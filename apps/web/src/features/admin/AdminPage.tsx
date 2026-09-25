import { REFUND_STATUSES, type RefundStatus } from '@worknoon/contracts';
import { AlertTriangle, ChevronLeft, ChevronRight, LogOut, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { cn } from '@/shared/lib/cn';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ADMIN_PAGE_SIZE, useRefundRequests, useStats } from './api';
import { RefundDetailSheet } from './components/RefundDetailSheet';
import { RefundTable } from './components/RefundTable';
import { ResetDemoButton } from './components/ResetDemoButton';
import { StatsCards } from './components/StatsCards';
import { TokenGate } from './components/TokenGate';
import { AdminSessionProvider, useAdminSession } from './hooks/useAdminSession';

type StatusFilter = RefundStatus | 'all';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'escalated', label: 'Escalated' },
];

function parseStatus(value: string | null): StatusFilter {
  return (REFUND_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as RefundStatus)
    : 'all';
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function AdminPage() {
  return (
    <AdminSessionProvider>
      <AdminContent />
    </AdminSessionProvider>
  );
}

function AdminContent() {
  const { token } = useAdminSession();
  return token ? <Dashboard /> : <TokenGate />;
}

function Dashboard() {
  const { signOut } = useAdminSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = parseStatus(searchParams.get('status'));
  const page = parsePage(searchParams.get('page'));
  const openId = searchParams.get('request');

  const stats = useStats();
  const list = useRefundRequests(status, page);

  function updateParams(changes: Record<string, string | null>) {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  const meta = list.data?.meta;
  const lastPage = meta?.lastPage ?? 1;
  const refreshing = (stats.isFetching || list.isFetching) && !stats.isPending && !list.isPending;
  const counts: Partial<Record<StatusFilter, number>> = stats.data
    ? { all: stats.data.total, ...stats.data.byStatus }
    : {};

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Refund requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every decision the assistant made, with the full rule trace. Escalated requests wait for
            you.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void stats.refetch();
              void list.refetch();
            }}
            aria-label="Refresh data"
          >
            <RefreshCw className={cn(refreshing && 'animate-spin')} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <ResetDemoButton />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </div>

      {stats.isError ? (
        <Card>
          <EmptyState
            icon={<AlertTriangle />}
            title="Couldn't load statistics"
            description={getErrorMessage(stats.error)}
          />
        </Card>
      ) : (
        <StatsCards stats={stats.data} isLoading={stats.isPending} />
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <Tabs
            value={status}
            onValueChange={(value) =>
              updateParams({ status: value === 'all' ? null : value, page: null })
            }
          >
            <TabsList aria-label="Filter by status">
              {FILTERS.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                  {counts[filter.value] !== undefined && (
                    <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                      {counts[filter.value]}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {meta && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {meta.total} result{meta.total === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {list.isError ? (
          <EmptyState
            icon={<AlertTriangle />}
            title="Couldn't load refund requests"
            description={getErrorMessage(list.error)}
          />
        ) : (
          <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
            <RefundTable
              rows={list.data?.data}
              isLoading={list.isPending}
              onOpen={(id) => updateParams({ request: id })}
              emptyDescription={
                status === 'all'
                  ? 'Run a scenario on the Customer page and the decision will appear here.'
                  : `No ${status} requests on this backend yet.`
              }
            />
          </div>
        )}

        {meta && meta.total > ADMIN_PAGE_SIZE && (
          <nav
            aria-label="Pagination"
            className="flex items-center justify-between gap-3 border-t px-4 py-3"
          >
            <p className="text-xs text-muted-foreground">
              Page {meta.page} of {lastPage}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => updateParams({ page: page - 1 <= 1 ? null : String(page - 1) })}
              >
                <ChevronLeft aria-hidden="true" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= lastPage}
                onClick={() => updateParams({ page: String(page + 1) })}
              >
                Next
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </Card>

      <RefundDetailSheet refundRequestId={openId} onClose={() => updateParams({ request: null })} />
    </div>
  );
}
