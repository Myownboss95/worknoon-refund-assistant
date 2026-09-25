import { FlagSchema, type Flag } from '@worknoon/contracts';
import { z } from 'zod';
import { RuleIdSchema, type RuleId } from '../config/contracts.schema.js';

/** JSON columns are `unknown` to the type system; these parse them back at the boundary. */
const RuleIdsSchema = z.array(RuleIdSchema);
const FlagsSchema = z.array(FlagSchema);
const ItemIdsSchema = z.array(z.string()).nullable();

export const parseRuleIds = (value: unknown): RuleId[] => RuleIdsSchema.parse(value);
export const parseFlags = (value: unknown): Flag[] => FlagsSchema.parse(value);
export const parseItemIds = (value: unknown): string[] | null => ItemIdsSchema.parse(value ?? null);
