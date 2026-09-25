import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_PACKAGE_NAME = '@worknoon/api-nest';

/**
 * Finds apps/api-nest by walking up from this file. Works from `src/` (tests, dev) and from
 * `dist/src/` (compiled) alike, so default paths never depend on the working directory.
 */
export function findAppRoot(start: string = dirname(fileURLToPath(import.meta.url))): string {
  let current = start;
  for (;;) {
    const candidate = join(current, 'package.json');
    if (existsSync(candidate)) {
      const pkg: unknown = JSON.parse(readFileSync(candidate, 'utf8'));
      if (
        typeof pkg === 'object' &&
        pkg !== null &&
        'name' in pkg &&
        pkg.name === APP_PACKAGE_NAME
      ) {
        return current;
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Could not locate the ${APP_PACKAGE_NAME} package root`);
    }
    current = parent;
  }
}

function resolveFromApp(value: string | undefined, fallback: string): string {
  const appRoot = findAppRoot();
  const chosen = value ?? fallback;
  return isAbsolute(chosen) ? chosen : resolve(appRoot, chosen);
}

export function resolveContractsPath(value: string | undefined): string {
  return resolveFromApp(value, '../../contracts');
}

export function resolvePolicyDocPath(value: string | undefined): string {
  return resolveFromApp(value, '../../policy/refund-policy.md');
}
