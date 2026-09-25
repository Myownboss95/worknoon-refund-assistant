import type { RefundRequestDetail } from '@worknoon/contracts';
import { AlertTriangle } from 'lucide-react';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { EmptyState } from '@/shared/ui/empty-state';
import { Skeleton } from '@/shared/ui/skeleton';
import { useRefundRequest } from '../api';
import { StatusBadge } from './StatusBadge';
import { RefundDetailBody } from './RefundDetailBody';

export interface RefundDetailSheetProps {
  refundRequestId: string | null;
  onClose: () => void;
}

export function RefundDetailSheet({ refundRequestId, onClose }: RefundDetailSheetProps) {
  const detail = useRefundRequest(refundRequestId);

  return (
    <Sheet open={Boolean(refundRequestId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>
              {detail.data ? `Refund for ${detail.data.orderNumber}` : 'Refund request'}
            </SheetTitle>
            {detail.data && <StatusBadge status={detail.data.status} />}
          </div>
          <SheetDescription>
            {detail.data
              ? `${detail.data.customer.name} · ${detail.data.customer.email}`
              : 'Decision trace, conversation and audit history.'}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          {detail.isPending ? (
            <DetailSkeleton />
          ) : detail.isError ? (
            <EmptyState
              icon={<AlertTriangle />}
              title="Couldn't load this request"
              description={getErrorMessage(detail.error)}
            />
          ) : (
            <RefundDetailBody detail={detail.data satisfies RefundRequestDetail} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-5 p-5" aria-busy="true" aria-label="Loading refund request">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-24" />
      <Skeleton className="h-48" />
      <Skeleton className="h-32" />
    </div>
  );
}
