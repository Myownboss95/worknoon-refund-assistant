import { defineConfig } from 'vitest/config';

// Every file shares one backend and one database, and most files reset the demo data first,
// so files must run one at a time and tests within a file in order.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
