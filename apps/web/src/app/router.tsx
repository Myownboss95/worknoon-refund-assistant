import { createBrowserRouter, type RouteObject } from 'react-router';
import { CustomerPage } from '@/features/chat/CustomerPage';
import { AppLayout } from './layout/AppLayout';
import { NotFoundPage } from './layout/NotFoundPage';
import { PageLoader } from './layout/PageLoader';
import { RouteErrorPage } from './layout/RouteErrorPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    HydrateFallback: PageLoader,
    children: [
      { index: true, Component: CustomerPage },
      {
        path: 'admin',
        lazy: () =>
          import('@/features/admin/AdminPage').then((module) => ({ Component: module.AdminPage })),
      },
      {
        path: 'policy',
        lazy: () =>
          import('@/features/policy/PolicyPage').then((module) => ({
            Component: module.PolicyPage,
          })),
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
