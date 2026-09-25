import { Loader2 } from 'lucide-react';

export function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
