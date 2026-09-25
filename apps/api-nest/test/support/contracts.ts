import { loadContracts, loadRedTeam, type Contracts } from '../../src/config/contracts.loader.js';
import type { RedTeamFile } from '../../src/config/contracts.schema.js';
import { resolveContractsPath } from '../../src/config/paths.js';

export const CONTRACTS_PATH = resolveContractsPath(undefined);

/** The real contracts/ files, parsed the same way the app parses them at boot. */
export const contracts: Contracts = loadContracts(CONTRACTS_PATH);
export const redTeam: RedTeamFile = loadRedTeam(CONTRACTS_PATH);
