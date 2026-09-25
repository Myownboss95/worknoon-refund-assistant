import { Loader2, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { useResetDemo } from '../api';

export function ResetDemoButton() {
  const [open, setOpen] = useState(false);
  const reset = useResetDemo();

  function confirm() {
    reset.mutate(undefined, {
      onSuccess: (result) => {
        setOpen(false);
        toast.success('Demo data reset', {
          description: `Re-seeded ${result.customers} customers and ${result.orders} orders.`,
        });
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !reset.isPending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw aria-hidden="true" />
          Reset demo data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-danger-soft text-danger-strong">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </div>
          <DialogTitle>Reset all demo data?</DialogTitle>
          <DialogDescription>
            This deletes every conversation, refund request and audit event on this backend and
            re-seeds the 15 demo customers. It can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={reset.isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={reset.isPending}>
            {reset.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {reset.isPending ? 'Resetting' : 'Reset data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
