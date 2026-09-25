#!/usr/bin/env node
// Usage: pnpm test:contract --backend=laravel|nest [--base-url=http://host/api/v1] [extra vitest args]
//
// Without --base-url the suite talks to the backend's published port (3002 Laravel, 3001 Nest).
// Use --base-url=http://localhost:8080/api/laravel/v1 to go through the web container's nginx.
import { spawnSync } from 'node:child_process';

const DEFAULT_BASE_URLS = {
  laravel: 'http://localhost:3002/api/v1',
  nest: 'http://localhost:3001/api/v1',
};

const passthrough = [];
let backend = process.env.CONTRACT_BACKEND ?? 'laravel';
let baseUrl = process.env.CONTRACT_BASE_URL;

for (const arg of process.argv.slice(2)) {
  if (arg === '--') continue;
  if (arg.startsWith('--backend=')) backend = arg.slice('--backend='.length);
  else if (arg.startsWith('--base-url=')) baseUrl = arg.slice('--base-url='.length);
  else passthrough.push(arg);
}

if (!(backend in DEFAULT_BASE_URLS)) {
  console.error(`Unknown backend "${backend}". Use --backend=laravel or --backend=nest.`);
  process.exit(2);
}

const env = {
  ...process.env,
  CONTRACT_BACKEND: backend,
  CONTRACT_BASE_URL: baseUrl ?? DEFAULT_BASE_URLS[backend],
};
console.log(`Contract suite → ${backend} at ${env.CONTRACT_BASE_URL}`);

const result = spawnSync('vitest', ['run', ...passthrough], { stdio: 'inherit', env, shell: true });
process.exit(result.status ?? 1);
