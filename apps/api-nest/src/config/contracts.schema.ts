import {
  FlagSchema,
  OrderStatusSchema,
  PolicyConfigSchema,
  ReasonCategorySchema,
  RefundStatusSchema,
} from '@worknoon/contracts';
import { z } from 'zod';
import { ExtractionOutputSchema } from '../ai/extraction-output.schema.js';

/** Zod schemas for every file in contracts/. Each file is parsed once at boot; a bad file stops the app. */

export const RULE_IDS = [
  'R01',
  'R02',
  'R03',
  'R04',
  'R05',
  'R06',
  'R07',
  'R08',
  'R09',
  'R10',
] as const;
export const RuleIdSchema = z.enum(RULE_IDS);
export type RuleId = z.infer<typeof RuleIdSchema>;

export const FullPolicyConfigSchema = PolicyConfigSchema.extend({
  approvableReasons: z.array(ReasonCategorySchema).min(1),
  merchantFaultReasons: z.array(ReasonCategorySchema).min(1),
  customerReasons: z.partialRecord(RuleIdSchema, z.string().min(1)),
});
export type FullPolicyConfig = z.infer<typeof FullPolicyConfigSchema>;

const SeedItemSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  unitPriceCents: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
  finalSale: z.boolean(),
});

const SeedOrderSchema = z.object({
  orderNumber: z.string().min(1),
  status: OrderStatusSchema,
  placedDaysAgo: z.number().int().nonnegative(),
  deliveredDaysAgo: z.number().int().nonnegative().nullable(),
  items: z.array(SeedItemSchema).min(1),
});

const SeedRefundHistorySchema = z.object({
  orderNumber: z.string().min(1),
  sku: z.string().min(1),
  status: RefundStatusSchema,
  reasonCategory: ReasonCategorySchema,
  daysAgo: z.number().int().nonnegative(),
});

export const SeedCustomerSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  orders: z.array(SeedOrderSchema).min(1),
  refundHistory: z.array(SeedRefundHistorySchema).optional(),
});
export type SeedCustomer = z.infer<typeof SeedCustomerSchema>;

export const ScenarioSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  customerKey: z.string(),
  email: z.email(),
  orderNumber: z.string(),
  skus: z.array(z.string()).min(1),
  messages: z.array(z.string()).min(1),
  expected: z.object({
    status: RefundStatusSchema,
    decisiveRuleIds: z.array(RuleIdSchema),
    amountCents: z.number().int(),
    flags: z.array(FlagSchema),
    clarifications: z.number().int().nonnegative(),
  }),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ScenariosFileSchema = z.object({
  customers: z.array(SeedCustomerSchema).min(1),
  scenarios: z.array(ScenarioSchema),
});
export type ScenariosFile = z.infer<typeof ScenariosFileSchema>;

export const AI_ERROR_CODES = ['timeout', 'provider_error', 'invalid_output'] as const;
export const AiErrorCodeSchema = z.enum(AI_ERROR_CODES);
export type AiErrorCode = z.infer<typeof AiErrorCodeSchema>;

const MockFixtureBaseSchema = z.object({
  id: z.string().min(1),
  anyOf: z.array(z.string().min(1)).min(1),
});

export const MockFixtureSchema = z.union([
  MockFixtureBaseSchema.extend({ error: AiErrorCodeSchema }),
  MockFixtureBaseSchema.extend({ extraction: ExtractionOutputSchema }),
]);
export type MockFixture = z.infer<typeof MockFixtureSchema>;

export const MockFixturesFileSchema = z.object({
  model: z.string().min(1),
  extract: z.array(MockFixtureSchema),
  extractDefault: ExtractionOutputSchema,
});
export type MockFixturesFile = z.infer<typeof MockFixturesFileSchema>;

export const InjectionPatternsFileSchema = z.object({
  patterns: z.array(z.object({ id: z.string().min(1), pattern: z.string().min(1) })).min(1),
});
export type InjectionPatternsFile = z.infer<typeof InjectionPatternsFileSchema>;

export const ReplyGuardFileSchema = z.object({
  maxLength: z.number().int().positive(),
  contradictions: z.object({
    approved: z.array(z.string().min(1)),
    denied: z.array(z.string().min(1)),
    escalated: z.array(z.string().min(1)),
  }),
  leakPatterns: z.array(z.string().min(1)),
});
export type ReplyGuardFile = z.infer<typeof ReplyGuardFileSchema>;

export const ReplyTemplatesFileSchema = z.object({
  greeting: z.string().min(1),
  clarify: z.string().min(1),
  approved: z.string().min(1),
  denied: z.string().min(1),
  escalated: z.string().min(1),
  humanApproved: z.string().min(1),
  humanDenied: z.string().min(1),
});
export type ReplyTemplates = z.infer<typeof ReplyTemplatesFileSchema>;

export const RedTeamFileSchema = z.object({
  email: z.email(),
  orderNumber: z.string(),
  skus: z.array(z.string()).min(1),
  attacks: z.array(z.object({ id: z.string(), text: z.string() })).min(1),
});
export type RedTeamFile = z.infer<typeof RedTeamFileSchema>;
