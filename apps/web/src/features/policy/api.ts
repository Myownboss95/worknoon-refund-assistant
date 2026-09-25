import { PolicySchema } from '@worknoon/contracts';
import { useQuery } from '@tanstack/react-query';
import { useApiClient, useBackend } from '@/app/BackendContext';

export function usePolicy() {
  const { backend } = useBackend();
  const client = useApiClient();
  return useQuery({
    queryKey: [backend, 'policy'],
    queryFn: () => client.get('/policy', undefined, PolicySchema),
    staleTime: 5 * 60_000,
  });
}
