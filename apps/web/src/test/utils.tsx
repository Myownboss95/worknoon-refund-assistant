import { QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const queryClient = createTestQueryClient();
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [route] });
  const result = render(
    <AppProviders queryClient={queryClient} initialBackend="laravel">
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...result, queryClient };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export interface MockRoute {
  method: 'GET' | 'POST';
  path: string | RegExp;
  respond: (init: { url: string; body: unknown }) => Response;
}

/** A tiny fetch stub that routes by method + path and records every call. */
export function mockFetch(routes: MockRoute[]) {
  const calls: { method: string; url: string; body: unknown; headers: Record<string, string> }[] =
    [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, url, body, headers: (init?.headers ?? {}) as Record<string, string> });
    const path = url.split('?')[0] ?? url;
    const route = routes.find(
      (candidate) =>
        candidate.method === method &&
        (typeof candidate.path === 'string'
          ? path.endsWith(candidate.path)
          : candidate.path.test(path)),
    );
    if (!route) return jsonResponse({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    return route.respond({ url, body });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}
