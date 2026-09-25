import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://refunds:refunds@localhost:55432/refunds_nest_test';

/** End-to-end tests: the real app against the refunds_nest_test database, one file at a time. */
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/e2e/**/*.e2e-spec.ts'],
    environment: 'node',
    globalSetup: ['test/e2e/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      LLM_PROVIDER: 'mock',
      ANTHROPIC_API_KEY: '',
      ADMIN_TOKEN: 'test-admin-token',
      // Tests reset the database between cases; suites that need it off override AppConfig.
      DEMO_MODE: 'true',
      TRUSTED_PROXIES: '',
      RATE_LIMIT_VERIFY_PER_MINUTE: '10000',
      RATE_LIMIT_MESSAGES_PER_MINUTE: '10000',
      RATE_LIMIT_ADMIN_FAILURES_PER_MINUTE: '10000',
      MAX_CONVERSATIONS_PER_ORDER_PER_DAY: '10000',
      LLM_MAX_CALLS_PER_HOUR: '1000',
    },
  },
});
