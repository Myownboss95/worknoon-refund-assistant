import { Bot } from 'lucide-react';

export function ThinkingIndicator() {
  return (
    <li className="flex items-end gap-2.5" aria-label="The assistant is thinking">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary dark:text-foreground">
        <Bot className="size-4" aria-hidden="true" />
      </span>
      <span className="flex items-center gap-2 rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2.5 text-sm text-muted-foreground shadow-xs">
        <span className="flex items-center gap-1" aria-hidden="true">
          <span className="typing-dot size-1.5 rounded-full bg-current" />
          <span className="typing-dot size-1.5 rounded-full bg-current [animation-delay:150ms]" />
          <span className="typing-dot size-1.5 rounded-full bg-current [animation-delay:300ms]" />
        </span>
        <span>Assistant is thinking</span>
      </span>
    </li>
  );
}
