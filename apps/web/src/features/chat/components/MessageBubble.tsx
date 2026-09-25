import type { Message, OrderItem } from '@worknoon/contracts';
import { Bot, Info } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { formatTime } from '@/shared/lib/formatDate';

export interface MessageBubbleProps {
  message: Pick<Message, 'role' | 'content' | 'itemIds' | 'createdAt'>;
  items: OrderItem[];
  pending?: boolean;
}

export function MessageBubble({ message, items, pending = false }: MessageBubbleProps) {
  if (message.role === 'system') {
    return (
      <li className="flex justify-center py-1">
        <div className="flex max-w-[90%] items-start gap-2 rounded-lg border border-dashed bg-subtle px-3.5 py-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <p className="whitespace-pre-wrap">
            <span className="sr-only">Update from the support team: </span>
            {message.content}
          </p>
        </div>
      </li>
    );
  }

  if (message.role === 'customer') {
    const itemNames = (message.itemIds ?? [])
      .map((itemId) => items.find((item) => item.id === itemId)?.name)
      .filter((name): name is string => Boolean(name));
    return (
      <li className={cn('flex flex-col items-end gap-1', pending && 'opacity-70')}>
        <span className="sr-only">You said:</span>
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-xs sm:max-w-[75%]">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="flex max-w-[85%] flex-wrap justify-end gap-1 text-[11px] text-muted-foreground">
          {itemNames.length > 0 && <span>Re: {itemNames.join(', ')}</span>}
          <span aria-hidden="true">{itemNames.length > 0 ? '·' : ''}</span>
          <span>{pending ? 'Sending' : formatTime(message.createdAt)}</span>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-end gap-2.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary dark:text-foreground">
        <Bot className="size-4" aria-hidden="true" />
      </span>
      <div className="flex max-w-[85%] flex-col gap-1 sm:max-w-[75%]">
        <span className="sr-only">Assistant said:</span>
        <div className="rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2.5 text-sm shadow-xs">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{formatTime(message.createdAt)}</span>
      </div>
    </li>
  );
}
