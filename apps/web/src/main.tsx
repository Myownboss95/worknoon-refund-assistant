import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { z } from 'zod';
import { AppProviders } from './app/providers';
import { createAppRouter } from './app/router';
import './index.css';

// The CSP has no 'unsafe-eval'. Zod's JIT probes `new Function` on first object parse, which a strict
// CSP reports as a violation even though Zod catches it; jitless skips the probe entirely.
z.config({ jitless: true });

const router = createAppRouter();
const container = document.getElementById('root');

if (container) {
  createRoot(container).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}
