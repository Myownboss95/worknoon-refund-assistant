/**
 * Zod mirror of contracts/openapi.yaml. The NestJS backend validates requests with these schemas and
 * the web app parses every response with them, so both sides fail loudly if the wire shape drifts.
 */
import { z } from 'zod';

const isoDateTime = z.iso.datetime({ offset: false });
const uuid = z.uuid();

// ---------------------------------------------------------------- enums

export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'VERIFICATION_FAILED',
  'NOT_FOUND',
  'CONVERSATION_CLOSED',
  'CONVERSATION_BUSY',
  'REFUND_ALREADY_EXISTS',
  'REFUND_NOT_REVIEWABLE',
  'ADMIN_UNAUTHORIZED',
  'RATE_LIMITED',
  'AI_UNAVAILABLE',
  'INTERNAL_ERROR',
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const REFUND_STATUSES = ['approved', 'denied', 'escalated'] as const;
export const RefundStatusSchema = z.enum(REFUND_STATUSES);
export type RefundStatus = z.infer<typeof RefundStatusSchema>;

export const REASON_CATEGORIES = [
  'damaged',
  'defective',
  'wrong_item',
  'changed_mind',
  'not_received',
  'other',
  'unclear',
] as const;
export const ReasonCategorySchema = z.enum(REASON_CATEGORIES);
export type ReasonCategory = z.infer<typeof ReasonCategorySchema>;

export const RULE_OUTCOMES = ['pass', 'not_applicable', 'deny', 'escalate', 'approve'] as const;
export const RuleOutcomeSchema = z.enum(RULE_OUTCOMES);
export type RuleOutcome = z.infer<typeof RuleOutcomeSchema>;

export const FLAGS = [
  'HIGH_REFUND_FREQUENCY',
  'CLAIM_CONFLICT',
  'INJECTION_HEURISTIC',
  'INJECTION_MODEL',
  'LOW_CONFIDENCE',
  'AI_UNAVAILABLE',
  'CLARIFICATION_EXHAUSTED',
  'REPLY_GUARD_FALLBACK',
  'COMPOSE_UNAVAILABLE',
] as const;
export const FlagSchema = z.enum(FLAGS);
export type Flag = z.infer<typeof FlagSchema>;

export const OrderStatusSchema = z.enum(['processing', 'shipped', 'delivered']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const ConversationStatusSchema = z.enum(['open', 'closed']);
export const MessageRoleSchema = z.enum(['customer', 'assistant', 'system']);
export const DecidedBySchema = z.enum(['policy', 'human']);
export const ReviewDecisionSchema = z.enum(['approve', 'deny']);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export const AiProviderSchema = z.enum(['mock', 'anthropic']);
export type AiProvider = z.infer<typeof AiProviderSchema>;

// ---------------------------------------------------------------- errors

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ---------------------------------------------------------------- system

export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  backend: z.enum(['laravel', 'nest']),
  database: z.enum(['ok', 'down']),
  ai: z.object({ provider: AiProviderSchema, model: z.string() }),
  policyVersion: z.string(),
  time: isoDateTime,
});
export type Health = z.infer<typeof HealthSchema>;

export const PolicyConfigSchema = z.object({
  version: z.string(),
  currency: z.string(),
  refundWindowDays: z.number().int(),
  changeOfMindWindowDays: z.number().int(),
  humanReviewThresholdCents: z.number().int(),
  suspiciousRefundCount: z.number().int(),
  suspiciousRefundLookbackDays: z.number().int(),
  minAiConfidence: z.number(),
  maxClarificationTurns: z.number().int(),
  maxMessageLength: z.number().int(),
  maxItemsPerRequest: z.number().int(),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const PolicySchema = z.object({
  version: z.string(),
  markdown: z.string(),
  config: PolicyConfigSchema,
});
export type Policy = z.infer<typeof PolicySchema>;

// ---------------------------------------------------------------- requests

export const VerifyRequestSchema = z.object({
  email: z.email().max(254),
  orderNumber: z.string().regex(/^[A-Za-z0-9-]{3,32}$/),
});
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const SendMessageRequestSchema = z.object({
  text: z.string().min(1).max(1000),
  itemIds: z
    .array(uuid)
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, { message: 'Item ids must be unique' }),
});
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

export const ReviewRequestSchema = z.object({
  decision: ReviewDecisionSchema,
  note: z.string().trim().min(3).max(1000),
});
export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

export const RefundListQuerySchema = z.object({
  status: RefundStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});
export type RefundListQuery = z.infer<typeof RefundListQuerySchema>;

// ---------------------------------------------------------------- customer side

export const OrderItemSchema = z.object({
  id: uuid,
  sku: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  lineTotalCents: z.number().int(),
  finalSale: z.boolean(),
  refundStatus: z.enum(['approved', 'pending']).nullable(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: uuid,
  orderNumber: z.string(),
  status: OrderStatusSchema,
  placedAt: isoDateTime,
  deliveredAt: isoDateTime.nullable(),
  totalCents: z.number().int(),
  currency: z.string(),
  items: z.array(OrderItemSchema),
});
export type Order = z.infer<typeof OrderSchema>;

export const MessageSchema = z.object({
  id: uuid,
  role: MessageRoleSchema,
  content: z.string(),
  itemIds: z.array(uuid).nullable(),
  createdAt: isoDateTime,
});
export type Message = z.infer<typeof MessageSchema>;

export const DecisionSchema = z.object({
  refundRequestId: uuid,
  status: RefundStatusSchema,
  decidedBy: DecidedBySchema,
  amountCents: z.number().int(),
  currency: z.string(),
  decisiveRuleIds: z.array(z.string()),
  customerReason: z.string(),
});
export type Decision = z.infer<typeof DecisionSchema>;

export const ConversationSummarySchema = z.object({
  id: uuid,
  status: ConversationStatusSchema,
  clarificationTurns: z.number().int(),
  createdAt: isoDateTime,
});
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;

const CustomerNameSchema = z.object({ name: z.string(), firstName: z.string() });

export const VerifyResponseSchema = z.object({
  conversation: ConversationSummarySchema,
  customer: CustomerNameSchema,
  order: OrderSchema,
  messages: z.array(MessageSchema),
});
export type VerifyResponse = z.infer<typeof VerifyResponseSchema>;

export const ConversationDetailSchema = z.object({
  conversation: ConversationSummarySchema,
  customer: CustomerNameSchema,
  order: OrderSchema,
  messages: z.array(MessageSchema),
  decision: DecisionSchema.nullable(),
});
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;

export const SendMessageResponseSchema = z.object({
  conversation: ConversationSummarySchema,
  messages: z.array(MessageSchema),
  reply: MessageSchema,
  decision: DecisionSchema.nullable(),
});
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

// ---------------------------------------------------------------- AI

export const ExtractionSchema = z.object({
  reasonCategory: ReasonCategorySchema,
  itemsMentioned: z.array(z.string()),
  claimsConflict: z.boolean(),
  injectionSuspected: z.boolean(),
  summary: z.string().max(280),
  confidence: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

// ---------------------------------------------------------------- admin

export const RuleResultSchema = z.object({
  ruleId: z.string(),
  outcome: RuleOutcomeSchema,
  reason: z.string(),
});
export type RuleResult = z.infer<typeof RuleResultSchema>;

export const AiCallSchema = z.object({
  step: z.enum(['extract', 'compose']),
  attempt: z.number().int(),
  ok: z.boolean(),
  latencyMs: z.number().int(),
  inputTokens: z.number().int(),
  outputTokens: z.number().int(),
  error: z.enum(['timeout', 'provider_error', 'invalid_output']).nullable(),
});
export type AiCall = z.infer<typeof AiCallSchema>;

export const DecisionTraceSchema = z.object({
  policyVersion: z.string(),
  evaluatedAt: isoDateTime,
  facts: z.object({
    orderStatus: z.string(),
    daysSinceDelivery: z.number().int().nullable(),
    amountCents: z.number().int(),
    recentApprovedRefunds: z.number().int(),
    finalSaleItemIds: z.array(z.string()),
    alreadyRefundedItemIds: z.array(z.string()),
  }),
  rules: z.array(RuleResultSchema),
  extraction: ExtractionSchema.nullable(),
  heuristicMatches: z.array(z.string()),
  flags: z.array(FlagSchema),
  clarificationTurns: z.number().int(),
  ai: z.object({
    provider: AiProviderSchema,
    model: z.string(),
    promptVersions: z.object({ extract: z.string(), compose: z.string() }),
    calls: z.array(AiCallSchema),
  }),
  replyGuard: z.object({
    passed: z.boolean(),
    violations: z.array(z.string()),
    usedTemplate: z.boolean(),
  }),
});
export type DecisionTrace = z.infer<typeof DecisionTraceSchema>;

export const RefundRequestSummarySchema = z.object({
  id: uuid,
  status: RefundStatusSchema,
  decidedBy: DecidedBySchema,
  customer: z.object({ name: z.string(), email: z.string() }),
  orderNumber: z.string(),
  amountCents: z.number().int(),
  currency: z.string(),
  reasonCategory: ReasonCategorySchema.nullable(),
  flags: z.array(FlagSchema),
  decisiveRuleIds: z.array(z.string()),
  createdAt: isoDateTime,
});
export type RefundRequestSummary = z.infer<typeof RefundRequestSummarySchema>;

export const RefundRequestListSchema = z.object({
  data: z.array(RefundRequestSummarySchema),
  meta: z.object({
    page: z.number().int(),
    perPage: z.number().int(),
    total: z.number().int(),
    lastPage: z.number().int(),
  }),
});
export type RefundRequestList = z.infer<typeof RefundRequestListSchema>;

export const AuditEventSchema = z.object({
  id: uuid,
  type: z.string(),
  actor: z.string(),
  data: z.record(z.string(), z.unknown()),
  createdAt: isoDateTime,
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const RefundRequestDetailSchema = RefundRequestSummarySchema.extend({
  items: z.array(
    z.object({
      orderItemId: uuid,
      sku: z.string(),
      name: z.string(),
      quantity: z.number().int(),
      amountCents: z.number().int(),
      finalSale: z.boolean(),
    }),
  ),
  conversation: z.object({ id: uuid, messages: z.array(MessageSchema) }),
  trace: DecisionTraceSchema,
  review: z
    .object({
      decision: ReviewDecisionSchema,
      note: z.string(),
      reviewer: z.string(),
      reviewedAt: isoDateTime,
    })
    .nullable(),
  auditEvents: z.array(AuditEventSchema),
});
export type RefundRequestDetail = z.infer<typeof RefundRequestDetailSchema>;

export const StatsSchema = z.object({
  total: z.number().int(),
  byStatus: z.object({
    approved: z.number().int(),
    denied: z.number().int(),
    escalated: z.number().int(),
  }),
  escalatedTotal: z.number().int(),
  humanReviewed: z.number().int(),
  escalationRate: z.number(),
  autoResolutionRate: z.number(),
});
export type Stats = z.infer<typeof StatsSchema>;

export const ResetResponseSchema = z.object({
  reset: z.literal(true),
  customers: z.number().int(),
  orders: z.number().int(),
});
export type ResetResponse = z.infer<typeof ResetResponseSchema>;
