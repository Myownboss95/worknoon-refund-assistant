import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from '@/shared/api/client';
import { readStorage, writeStorage } from '@/shared/lib/storage';

export const BACKENDS = {
  laravel: { label: 'Laravel', baseUrl: '/api/laravel/v1' },
  nest: { label: 'NestJS', baseUrl: '/api/nest/v1' },
} as const;

export type Backend = keyof typeof BACKENDS;

const STORAGE_KEY = 'worknoon.backend';

export function isBackend(value: unknown): value is Backend {
  return value === 'laravel' || value === 'nest';
}

interface BackendContextValue {
  backend: Backend;
  baseUrl: string;
  setBackend: (backend: Backend) => void;
}

const BackendContext = createContext<BackendContextValue | null>(null);

export function BackendProvider({
  children,
  initialBackend,
}: {
  children: ReactNode;
  initialBackend?: Backend;
}) {
  const [backend, setBackendState] = useState<Backend>(() => {
    if (initialBackend) return initialBackend;
    const stored = readStorage('local', STORAGE_KEY);
    return isBackend(stored) ? stored : 'laravel';
  });

  const value = useMemo<BackendContextValue>(
    () => ({
      backend,
      baseUrl: BACKENDS[backend].baseUrl,
      setBackend: (next) => {
        writeStorage('local', STORAGE_KEY, next);
        setBackendState(next);
      },
    }),
    [backend],
  );

  return <BackendContext value={value}>{children}</BackendContext>;
}

export function useBackend(): BackendContextValue {
  const context = use(BackendContext);
  if (!context) throw new Error('useBackend must be used inside <BackendProvider>');
  return context;
}

/** An API client bound to the selected backend (and the admin token, when given). */
export function useApiClient(adminToken?: string | null): ApiClient {
  const { baseUrl } = useBackend();
  return useMemo(() => createApiClient({ baseUrl, adminToken }), [baseUrl, adminToken]);
}
