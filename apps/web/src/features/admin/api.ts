import {
  RefundRequestDetailSchema,
  RefundRequestListSchema,
  ResetResponseSchema,
  StatsSchema,
  type RefundStatus,
  type ReviewRequest,
} from '@worknoon/contracts';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient, useBackend, type Backend } from '@/app/BackendContext';
import { ApiError } from '@/shared/api/ApiError';
import { useAdminSession } from './hooks/useAdminSession';

export const ADMIN_PAGE_SIZE = 10;

export const adminKeys = {
  stats: (backend: Backend) => [backend, 'stats'] as const,
  lists: (backend: Backend) => [backend, 'refund-requests'] as const,
  list: (backend: Backend, status: RefundStatus | 'all', page: number) =>
    [backend, 'refund-requests', status, page] as const,
  detail: (backend: Backend, id: string) => [backend, 'refund-request', id] as const,
};

/** Admin client plus a guard that clears the token when the server answers 401. */
function useAdminApi() {
  const { backend } = useBackend();
  const session = useAdminSession();
  const client = useApiClient(session.token);

  async function guard<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) session.expire();
      throw error;
    }
  }

  return { backend, client, guard, enabled: Boolean(session.token) };
}

export function useStats() {
  const { backend, client, guard, enabled } = useAdminApi();
  return useQuery({
    queryKey: adminKeys.stats(backend),
    queryFn: () => guard(() => client.get('/admin/stats', undefined, StatsSchema)),
    enabled,
  });
}

export function useRefundRequests(status: RefundStatus | 'all', page: number) {
  const { backend, client, guard, enabled } = useAdminApi();
  return useQuery({
    queryKey: adminKeys.list(backend, status, page),
    queryFn: () =>
      guard(() =>
        client.get(
          '/admin/refund-requests',
          { status: status === 'all' ? undefined : status, page, perPage: ADMIN_PAGE_SIZE },
          RefundRequestListSchema,
        ),
      ),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRefundRequest(id: string | null) {
  const { backend, client, guard, enabled } = useAdminApi();
  return useQuery({
    queryKey: adminKeys.detail(backend, id ?? ''),
    queryFn: () =>
      guard(() =>
        client.get(
          `/admin/refund-requests/${encodeURIComponent(id ?? '')}`,
          undefined,
          RefundRequestDetailSchema,
        ),
      ),
    enabled: enabled && Boolean(id),
  });
}

export function useReviewRefund(id: string) {
  const { backend, client, guard } = useAdminApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewRequest) =>
      guard(() =>
        client.post(
          `/admin/refund-requests/${encodeURIComponent(id)}/review`,
          input,
          RefundRequestDetailSchema,
        ),
      ),
    onSuccess: async (detail) => {
      queryClient.setQueryData(adminKeys.detail(backend, id), detail);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.lists(backend) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.stats(backend) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.detail(backend, id) }),
      ]);
    },
  });
}

export function useResetDemo() {
  const { backend, client, guard } = useAdminApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => guard(() => client.post('/admin/demo/reset', {}, ResetResponseSchema)),
    onSuccess: async () => {
      // Everything cached for this backend (admin data, conversations, orders) is now stale.
      queryClient.removeQueries({ queryKey: [backend, 'refund-request'] });
      await queryClient.invalidateQueries({ queryKey: [backend] });
    },
  });
}
