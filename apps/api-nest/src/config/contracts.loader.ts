import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import {
  FullPolicyConfigSchema,
  InjectionPatternsFileSchema,
  MockFixturesFileSchema,
  RedTeamFileSchema,
  ReplyGuardFileSchema,
  ReplyTemplatesFileSchema,
  ScenariosFileSchema,
  type FullPolicyConfig,
  type InjectionPatternsFile,
  type MockFixturesFile,
  type RedTeamFile,
  type ReplyGuardFile,
  type ReplyTemplates,
  type ScenariosFile,
} from './contracts.schema.js';

/** Everything read from contracts/ at boot, already validated. */
export interface Contracts {
  readonly path: string;
  readonly policy: FullPolicyConfig;
  readonly scenarios: ScenariosFile;
  readonly mockFixtures: MockFixturesFile;
  readonly injectionPatterns: InjectionPatternsFile;
  readonly replyGuard: ReplyGuardFile;
  readonly templates: ReplyTemplates;
}

export function readJsonContract<T extends z.ZodType>(
  contractsPath: string,
  fileName: string,
  schema: T,
): z.infer<T> {
  const filePath = join(contractsPath, fileName);
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read contract ${filePath}: ${reason}`, { cause: error });
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Contract ${filePath} is invalid: ${result.error.message}`);
  }
  return result.data;
}

export function loadContracts(contractsPath: string): Contracts {
  return {
    path: contractsPath,
    policy: readJsonContract(contractsPath, 'policy.config.json', FullPolicyConfigSchema),
    scenarios: readJsonContract(contractsPath, 'scenarios.json', ScenariosFileSchema),
    mockFixtures: readJsonContract(contractsPath, 'mock-llm-fixtures.json', MockFixturesFileSchema),
    injectionPatterns: readJsonContract(
      contractsPath,
      'injection-patterns.json',
      InjectionPatternsFileSchema,
    ),
    replyGuard: readJsonContract(contractsPath, 'reply-guard.json', ReplyGuardFileSchema),
    templates: readJsonContract(contractsPath, 'reply-templates.json', ReplyTemplatesFileSchema),
  };
}

export function loadRedTeam(contractsPath: string): RedTeamFile {
  return readJsonContract(contractsPath, 'red-team.json', RedTeamFileSchema);
}
