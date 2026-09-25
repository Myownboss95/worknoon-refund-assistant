import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { TEST_DATABASE_URL } from '../../vitest.e2e.config.js';

/** Brings the test database schema up to date once before the e2e run. */
export default function setup(): void {
  const appRoot = resolve(import.meta.dirname, '../..');
  execFileSync(resolve(appRoot, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: appRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
