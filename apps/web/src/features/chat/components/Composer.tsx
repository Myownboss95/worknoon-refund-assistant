import { Lock, SendHorizontal, Sparkles } from 'lucide-react';
import { useId, type FormEvent, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { Textarea } from '@/shared/ui/textarea';

export const MAX_MESSAGE_LENGTH = 1000;

export interface ComposerProps {
  text: string;
  onTextChange: (text: string) => void;
  selectedCount: number;
  onSubmit: () => void;
  isSending: boolean;
  closed: boolean;
  sampleMessage?: string | null;
  onUseSample?: () => void;
}

export function Composer({
  text,
  onTextChange,
  selectedCount,
  onSubmit,
  isSending,
  closed,
  sampleMessage,
  onUseSample,
}: ComposerProps) {
  const id = useId();
  const trimmed = text.trim();
  const canSend =
    !closed &&
    !isSending &&
    selectedCount > 0 &&
    trimmed.length > 0 &&
    text.length <= MAX_MESSAGE_LENGTH;
  const remaining = MAX_MESSAGE_LENGTH - text.length;

  const hint = closed
    ? 'This conversation is closed.'
    : selectedCount === 0
      ? 'Select at least one item from your order above.'
      : trimmed.length === 0
        ? 'Describe what went wrong.'
        : 'Press Enter to send, Shift + Enter for a new line.';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  }

  if (closed) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-subtle px-4 py-3 text-sm text-muted-foreground">
        <Lock className="size-4" aria-hidden="true" />
        This conversation is closed. Start over to make another request.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2" aria-label="Send a message">
      {sampleMessage && onUseSample && (
        <div>
          <button
            type="button"
            onClick={onUseSample}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 text-xs font-medium text-primary transition-colors outline-none hover:bg-primary-soft/70 focus-visible:ring-[3px] focus-visible:ring-ring/40 dark:text-foreground"
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            Use sample message
          </button>
        </div>
      )}
      <label htmlFor={`${id}-message`} className="sr-only">
        Your message
      </label>
      <div className="relative">
        <Textarea
          id={`${id}-message`}
          value={text}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={3}
          placeholder="Tell us what happened with your order"
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          aria-describedby={`${id}-hint ${id}-count`}
          className="max-h-48 min-h-24 resize-none pr-14 pb-8"
        />
        <span
          id={`${id}-count`}
          className={cn(
            'pointer-events-none absolute right-3 bottom-2 text-[11px] tabular-nums text-muted-foreground',
            remaining < 100 && 'text-warning-strong',
          )}
        >
          <span className="sr-only">Characters used: </span>
          {text.length}/{MAX_MESSAGE_LENGTH}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
        <Button type="submit" disabled={!canSend} className="ml-auto">
          Send
          <SendHorizontal aria-hidden="true" />
        </Button>
      </div>
    </form>
  );
}
