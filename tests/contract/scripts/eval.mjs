#!/usr/bin/env node
// Runs the 15 demo scenarios against a backend that is using the real model (LLM_PROVIDER=anthropic)
// and prints how many reached the expected outcome. Unlike the contract suite this is not
// deterministic: it measures how well the extraction prompt works, so treat it as an eval.
//
// Usage: pnpm eval --backend=laravel|nest [--base-url=...]
import { readFileSync } from 'node:fs';

const DEFAULT_BASE_URLS = { laravel: 'http://localhost:3002/api/v1', nest: 'http://localhost:3001/api/v1' };
let backend = 'laravel';
let baseUrl;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--backend=')) backend = arg.slice(10);
  if (arg.startsWith('--base-url=')) baseUrl = arg.slice(11);
}
baseUrl ??= DEFAULT_BASE_URLS[backend];
const adminToken = process.env.ADMIN_TOKEN ?? 'demo-admin';

const { scenarios } = JSON.parse(
  readFileSync(new URL('../../../contracts/scenarios.json', import.meta.url), 'utf8'),
);

const call = async (method, path, body, admin = false) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(admin ? { 'X-Admin-Token': adminToken } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
};

const health = await call('GET', '/health');
if (health.ai.provider !== 'anthropic') {
  console.error(`The ${backend} backend is in ${health.ai.provider} mode. Set LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY.`);
  process.exit(2);
}
console.log(`Eval → ${backend} (${health.ai.model}) at ${baseUrl}\n`);
await call('POST', '/admin/demo/reset', undefined, true);

let passed = 0;
for (const s of scenarios) {
  const verified = await call('POST', '/customers/verify', { email: s.email, orderNumber: s.orderNumber });
  const itemIds = s.skus.map((sku) => verified.order.items.find((i) => i.sku === sku).id);
  let reply;
  for (const text of s.messages) {
    reply = await call('POST', `/conversations/${verified.conversation.id}/messages`, { text, itemIds });
  }
  const got = reply.decision ? `${reply.decision.status} [${reply.decision.decisiveRuleIds.join(',')}]` : 'no decision';
  const want = `${s.expected.status} [${s.expected.decisiveRuleIds.join(',')}]`;
  const ok = got === want;
  if (ok) passed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  #${String(s.id).padStart(2)} ${s.title.padEnd(44)} expected ${want.padEnd(26)} got ${got}`);
}
console.log(`\n${passed}/${scenarios.length} scenarios matched (${Math.round((passed / scenarios.length) * 100)}%)`);
process.exit(passed === scenarios.length ? 0 : 1);
