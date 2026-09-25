import type { Message, OrderItem } from '@worknoon/contracts';
import { MessagesSquare } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { EmptyState } from '@/shared/ui/empty-state';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';

export interface MessageListProps {
  messages: Message[];
  items: OrderItem[];
  pendingMessage?: { content: string; itemIds: string[] } | null;
}

export function MessageList({ messages, items, pendingMessage }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const latestAnnouncement = [...messages].reverse().find((message) => message.role !== 'customer');
  const count = messages.length + (pendingMessage ? 1 : 0);

  // Keep the newest message in view (DOM synchronisation, not data fetching).
  useEffect(() => {
    // Scroll only the message pane, never the whole page.
    const pane = endRef.current?.closest<HTMLElement>('[data-scroll-pane]');
    if (count > 0 && pane) pane.scrollTo?.({ top: pane.scrollHeight, behavior: 'smooth' });
  }, [count]);

  return (
    <div className="flex flex-col">
      {messages.length === 0 && !pendingMessage ? (
        <EmptyState
          icon={<MessagesSquare />}
          title="No messages yet"
          description="Say hello to get started."
        />
      ) : (
        <ol aria-label="Conversation" className="flex flex-col gap-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} items={items} />
          ))}
          {pendingMessage && (
            <>
              <MessageBubble
                pending
                items={items}
                message={{
                  role: 'customer',
                  content: pendingMessage.content,
                  itemIds: pendingMessage.itemIds,
                  createdAt: new Date().toISOString(),
                }}
              />
              <ThinkingIndicator />
            </>
          )}
        </ol>
      )}
      <div ref={endRef} />
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="assistant-live-region"
      >
        {pendingMessage
          ? 'The assistant is thinking.'
          : latestAnnouncement
            ? `${latestAnnouncement.role === 'system' ? 'Support update' : 'Assistant'}: ${latestAnnouncement.content}`
            : ''}
      </div>
    </div>
  );
}
