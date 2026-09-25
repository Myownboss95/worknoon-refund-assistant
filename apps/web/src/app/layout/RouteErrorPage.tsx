import { AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';

export function RouteErrorPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<AlertTriangle />}
        title="Something went wrong"
        description="An unexpected error occurred while rendering this page."
        action={
          <Button variant="outline" onClick={() => window.location.assign('/')}>
            Reload the app
          </Button>
        }
      />
    </div>
  );
}
