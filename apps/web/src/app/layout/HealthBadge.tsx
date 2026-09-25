import { Cpu } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { useHealth } from '../health';

export function HealthBadge() {
  const health = useHealth();
  const healthy = health.isSuccess && health.data.status === 'ok';
  const failed = health.isError || (health.isSuccess && health.data.status !== 'ok');

  const label = health.isPending
    ? 'AI: checking'
    : health.isSuccess
      ? `AI: ${health.data.ai.provider === 'mock' ? 'mock' : health.data.ai.model}`
      : 'AI: unknown';

  const statusText = health.isPending
    ? 'Checking backend health'
    : healthy
      ? 'Backend healthy'
      : 'Backend unavailable';

  return (
    <span
      className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-card px-2.5 text-xs font-medium text-muted-foreground"
      title={statusText}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full',
          health.isPending && 'animate-pulse bg-muted-foreground/50',
          healthy && 'bg-success',
          failed && 'bg-danger',
        )}
      />
      <Cpu className="hidden size-3.5 sm:block" aria-hidden="true" />
      <span className="font-mono">{label}</span>
      <span className="sr-only">. {statusText}</span>
    </span>
  );
}
