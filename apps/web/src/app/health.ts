import { HealthSchema } from '@worknoon/contracts';
import { useQuery } from '@tanstack/react-query';
import { useApiClient, useBackend } from './BackendContext';

export function useHealth() {
  const { backend } = useBackend();
  const client = useApiClient();
  return useQuery({
    queryKey: [backend, 'health'],
    queryFn: () => client.get('/health', undefined, HealthSchema),
    refetchInterval: 30_000,
    retry: false,
  });
}
