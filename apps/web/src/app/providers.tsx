import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/shared/ui/sonner';
import { BackendProvider, type Backend } from './BackendContext';
import { createQueryClient } from './queryClient';

export function AppProviders({
  children,
  queryClient,
  initialBackend,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
  initialBackend?: Backend;
}) {
  const [client] = useState(() => queryClient ?? createQueryClient());
  return (
    <QueryClientProvider client={client}>
      <BackendProvider initialBackend={initialBackend}>
        {children}
        <Toaster />
      </BackendProvider>
    </QueryClientProvider>
  );
}
