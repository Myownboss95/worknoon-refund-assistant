import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// Dev proxy targets; override when the APIs run elsewhere.
const laravelTarget = process.env.LARAVEL_API_URL ?? 'http://localhost:3002';
const nestTarget = process.env.NEST_API_URL ?? 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@repo-contracts': fileURLToPath(new URL('../../contracts', import.meta.url)),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/,
              priority: 20,
            },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    fs: { allow: [repoRoot] },
    proxy: {
      '/api/laravel/': {
        target: laravelTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/laravel\//, '/api/'),
      },
      '/api/nest/': {
        target: nestTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nest\//, '/api/'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
