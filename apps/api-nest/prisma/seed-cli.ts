import { existsSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { readJsonContract } from '../src/config/contracts.loader.js';
import { FullPolicyConfigSchema, ScenariosFileSchema } from '../src/config/contracts.schema.js';
import { parseEnv } from '../src/config/env.schema.js';
import { resolveContractsPath } from '../src/config/paths.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { resetDatabase, seedIfEmpty } from './seed.js';

/**
 * `node dist/prisma/seed-cli.js [--reset]`: seeds an empty database (the Docker entrypoint runs this
 * on every boot); `--reset` truncates first.
 */
async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const env = parseEnv(process.env);
  const contractsPath = resolveContractsPath(env.CONTRACTS_PATH);
  const scenarios = readJsonContract(contractsPath, 'scenarios.json', ScenariosFileSchema);
  const { currency } = readJsonContract(
    contractsPath,
    'policy.config.json',
    FullPolicyConfigSchema,
  );
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  try {
    const reset = process.argv.includes('--reset');
    const summary = reset
      ? await resetDatabase(prisma, scenarios, { currency })
      : await seedIfEmpty(prisma, scenarios, { currency });
    const line =
      summary === null
        ? { event: 'seed', seeded: false, reason: 'customers table is not empty' }
        : { event: 'seed', seeded: true, reset, ...summary };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${JSON.stringify({ event: 'seed', ok: false, error: message })}\n`);
  process.exitCode = 1;
});
