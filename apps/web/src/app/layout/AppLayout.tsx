import { Outlet } from 'react-router';
import { useBackend } from '../BackendContext';
import { Header } from './Header';

export function AppLayout() {
  const { backend } = useBackend();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {/* Keyed by backend so switching resets page state (e.g. the customer conversation). */}
        <Outlet key={backend} />
      </main>
      <footer className="border-t py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Worknoon Refund Assistant</span>
          <span>Rules decide. AI understands and explains.</span>
        </div>
      </footer>
    </div>
  );
}
