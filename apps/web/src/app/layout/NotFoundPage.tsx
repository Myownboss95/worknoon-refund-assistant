import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={
          <Button asChild variant="outline">
            <Link to="/">Back to the assistant</Link>
          </Button>
        }
      />
    </div>
  );
}
