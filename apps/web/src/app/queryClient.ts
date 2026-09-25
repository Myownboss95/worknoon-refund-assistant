import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/ApiError';

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors are final; only retry network blips and 5xx once.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 15_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
