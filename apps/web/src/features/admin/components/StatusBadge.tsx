import type { RefundStatus } from '@worknoon/contracts';
import { refundStatusMap } from '@/shared/lib/statusMap';
import { Badge } from '@/shared/ui/badge';

export function StatusBadge({ status }: { status: RefundStatus }) {
  const meta = refundStatusMap[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}
