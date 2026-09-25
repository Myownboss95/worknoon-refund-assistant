import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/lib/errorMessages';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Skeleton } from '@/shared/ui/skeleton';
import { useConversation, useSendMessage } from '../api';
import type { DemoScenario } from '../hooks/useScenarios';
import { Composer } from './Composer';
import { DecisionCard } from './DecisionCard';
import { MessageList } from './MessageList';
import { OrderCard } from './OrderCard';

export interface ConversationViewProps {
  conversationId: string;
  /** The demo scenario matching this order, if any; powers the "Use sample message" chip. */
  scenario: DemoScenario | null;
  onStartOver: () => void;
}

export function ConversationView({ conversationId, scenario, onStartOver }: ConversationViewProps) {
  const conversation = useConversation(conversationId);
  const send = useSendMessage(conversationId);
  const [text, setText] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  if (conversation.isPending) return <ConversationSkeleton />;

  if (conversation.isError) {
    return (
      <Card>
        <EmptyState
          icon={<AlertTriangle />}
          title="We couldn't load this conversation"
          description={getErrorMessage(conversation.error)}
          action={
            <Button variant="outline" onClick={onStartOver}>
              <RotateCcw aria-hidden="true" />
              Start over
            </Button>
          }
        />
      </Card>
    );
  }

  const { order, customer, messages, decision } = conversation.data;
  const closed = conversation.data.conversation.status === 'closed';
  // Items that became refunded or pending can no longer be selected.
  const selectableIds = new Set(
    order.items.filter((item) => item.refundStatus === null).map((item) => item.id),
  );
  const effectiveSelection = selectedItemIds.filter((itemId) => selectableIds.has(itemId));

  const customerMessageCount = messages.filter((message) => message.role === 'customer').length;
  const sampleMessage =
    scenario && scenario.orderNumber.toUpperCase() === order.orderNumber.toUpperCase() && !closed
      ? (scenario.messages[customerMessageCount] ?? null)
      : null;

  function toggleItem(itemId: string, selected: boolean) {
    setSelectedItemIds((current) =>
      selected
        ? [...new Set([...current, itemId])]
        : current.filter((existing) => existing !== itemId),
    );
  }

  function applySample() {
    if (!scenario || !sampleMessage) return;
    setText(sampleMessage);
    setSelectedItemIds(
      order.items
        .filter((item) => scenario.skus.includes(item.sku) && selectableIds.has(item.id))
        .map((item) => item.id),
    );
  }

  function handleSend() {
    const payload = { text: text.trim(), itemIds: effectiveSelection };
    send.mutate(payload, {
      onSuccess: (response) => {
        setText('');
        if (response.decision === null) {
          toast.message('The assistant needs a little more detail', {
            description: 'Reply below to continue.',
          });
        }
      },
      onError: (error) => {
        toast.error(getErrorMessage(error));
      },
    });
  }

  return (
    <div className="grid gap-4">
      <OrderCard
        order={order}
        customerName={customer.name}
        selectedItemIds={effectiveSelection}
        onToggleItem={toggleItem}
        disabled={closed || send.isPending}
      />

      <Card className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold">Refund assistant</h2>
            <p className="text-xs text-muted-foreground">
              Chatting as {customer.name}
              {closed ? ' · Resolved' : ''}
            </p>
          </div>
          {!decision && (
            <Button variant="ghost" size="sm" onClick={onStartOver}>
              <RotateCcw aria-hidden="true" />
              Start over
            </Button>
          )}
        </div>

        <div
          data-scroll-pane
          className="max-h-[60dvh] min-h-64 overflow-y-auto bg-subtle/60 px-4 py-5 sm:px-5"
        >
          <MessageList
            messages={messages}
            items={order.items}
            pendingMessage={
              send.isPending && send.variables
                ? { content: send.variables.text, itemIds: send.variables.itemIds }
                : null
            }
          />
        </div>

        <div className="grid gap-4 border-t p-4 sm:p-5">
          {decision && <DecisionCard decision={decision} onStartOver={onStartOver} />}
          <Composer
            text={text}
            onTextChange={setText}
            selectedCount={effectiveSelection.length}
            onSubmit={handleSend}
            isSending={send.isPending}
            closed={closed}
            sampleMessage={send.isPending ? null : sampleMessage}
            onUseSample={applySample}
          />
        </div>
      </Card>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading conversation">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <div className="grid gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="mt-5 h-12 w-full" />
      </Card>
      <Card className="grid gap-4 p-5">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </Card>
    </div>
  );
}
