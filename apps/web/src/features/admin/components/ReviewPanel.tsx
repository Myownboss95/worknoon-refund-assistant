import { ReviewRequestSchema, type ReviewDecision } from '@worknoon/contracts';
import { Check, Loader2, UserCheck, X } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { useReviewRefund } from '../api';

export const MIN_NOTE_LENGTH = 3;

export function validateReviewNote(note: string): string | null {
  const trimmed = note.trim();
  if (trimmed.length < MIN_NOTE_LENGTH)
    return `Add a note of at least ${MIN_NOTE_LENGTH} characters explaining your decision.`;
  if (trimmed.length > 1000) return 'Keep the note under 1000 characters.';
  return null;
}

export function ReviewPanel({ refundRequestId }: { refundRequestId: string }) {
  const id = useId();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const review = useReviewRefund(refundRequestId);
  const pendingDecision = review.isPending ? review.variables?.decision : undefined;

  function submit(decision: ReviewDecision) {
    const validationError = validateReviewNote(note);
    const parsed = ReviewRequestSchema.safeParse({ decision, note });
    if (validationError || !parsed.success) {
      setError(validationError ?? 'Please check the note and try again.');
      return;
    }
    setError(null);
    review.mutate(parsed.data, {
      onSuccess: () => {
        setNote('');
        toast.success(decision === 'approve' ? 'Refund approved' : 'Refund denied', {
          description: 'The customer conversation has been updated.',
        });
      },
      onError: (mutationError) => toast.error(getErrorMessage(mutationError)),
    });
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-xl border border-warning/50 bg-warning-soft/60 p-4"
    >
      <div className="flex items-center gap-2">
        <UserCheck className="size-4 text-warning-strong" aria-hidden="true" />
        <h3 id={`${id}-title`} className="text-sm font-semibold">
          Human review required
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Approve or deny this escalated request. The note is stored with the audit trail.
      </p>
      <div className="mt-3 grid gap-2">
        <Label htmlFor={`${id}-note`}>Reviewer note</Label>
        <Textarea
          id={`${id}-note`}
          value={note}
          maxLength={1000}
          rows={3}
          placeholder="For example: photos confirm the damage, approving."
          onChange={(event) => {
            setNote(event.target.value);
            if (error) setError(null);
          }}
          disabled={review.isPending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="bg-card"
        />
        {error && (
          <p id={`${id}-error`} role="alert" className="text-sm text-danger-strong">
            {error}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => submit('deny')} disabled={review.isPending}>
          {pendingDecision === 'deny' ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <X aria-hidden="true" />
          )}
          Deny refund
        </Button>
        <Button variant="success" onClick={() => submit('approve')} disabled={review.isPending}>
          {pendingDecision === 'approve' ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Check aria-hidden="true" />
          )}
          Approve refund
        </Button>
      </div>
    </section>
  );
}
