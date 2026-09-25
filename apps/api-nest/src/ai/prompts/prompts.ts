import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EXTRACT_PROMPT_VERSION = 'extract.v1';
export const COMPOSE_PROMPT_VERSION = 'compose.v1';

export interface SystemPrompts {
  readonly extract: string;
  readonly compose: string;
}

/** Reads the versioned system prompts from contracts/prompts. */
export function loadSystemPrompts(contractsPath: string): SystemPrompts {
  const read = (version: string): string =>
    readFileSync(join(contractsPath, 'prompts', `${version}.md`), 'utf8').trim();
  return { extract: read(EXTRACT_PROMPT_VERSION), compose: read(COMPOSE_PROMPT_VERSION) };
}
