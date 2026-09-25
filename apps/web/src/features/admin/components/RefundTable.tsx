import type { RefundRequestSummary } from '@worknoon/contracts';
import { ChevronRight, Inbox } from 'lucide-react';
import { formatDateTime, formatRelative } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';
import { decidedByMap } from '@/shared/lib/statusMap';
import { Badge } from '@/shared/ui/badge';
import { EmptyState } from '@/shared/ui/empty-state';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { FlagChips, RuleChips } from './FlagChips';
import { StatusBadge } from './StatusBadge';

export interface RefundTableProps {
  rows: RefundRequestSummary[] | undefined;
  isLoading: boolean;
  onOpen: (id: string) => void;
  emptyDescription: string;
}

const COLUMNS = [
  'Created',
  'Customer',
  'Order',
  'Amount',
  'Status',
  'Decided by',
  'Flags',
  'Rules',
  '',
];

export function RefundTable({ rows, isLoading, onOpen, emptyDescription }: RefundTableProps) {
  if (!isLoading && rows && rows.length === 0) {
    return (
      <EmptyState icon={<Inbox />} title="No refund requests yet" description={emptyDescription} />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((column, index) => (
            <TableHead
              key={column || index}
              className={column === 'Amount' ? 'text-right' : undefined}
            >
              {column ? column : <span className="sr-only">Actions</span>}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading || !rows
          ? Array.from({ length: 5 }, (_, index) => (
              <TableRow key={index}>
                {COLUMNS.map((column, cell) => (
                  <TableCell key={`${column}-${cell}`}>
                    <Skeleton className="h-4 w-full min-w-12" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : rows.map((row) => (
              <TableRow key={row.id} className="cursor-pointer" onClick={() => onOpen(row.id)}>
                <TableCell className="whitespace-nowrap">
                  <time
                    dateTime={row.createdAt}
                    title={formatDateTime(row.createdAt)}
                    className="text-sm"
                  >
                    {formatRelative(row.createdAt)}
                  </time>
                  <div className="text-[11px] text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-44 truncate font-medium">{row.customer.name}</div>
                  <div className="max-w-44 truncate text-xs text-muted-foreground">
                    {row.customer.email}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {row.orderNumber}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatMoney(row.amountCents)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <Badge tone={decidedByMap[row.decidedBy].tone}>
                    {decidedByMap[row.decidedBy].label}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-40">
                  <FlagChips flags={row.flags} emptyLabel="—" />
                </TableCell>
                <TableCell>
                  <RuleChips ruleIds={row.decisiveRuleIds} emptyLabel="—" />
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(row.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-primary-soft focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:text-foreground"
                  >
                    View
                    <span className="sr-only">
                      {' '}
                      request from {row.customer.name} for order {row.orderNumber}
                    </span>
                    <ChevronRight className="size-3.5" aria-hidden="true" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
