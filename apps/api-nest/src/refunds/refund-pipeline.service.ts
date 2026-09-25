import { Inject, Injectable } from '@nestjs/common';
import {
  type AiCall,
  type DecisionTrace,
  type Extraction,
  type Flag,
  type SendMessageResponse,
} from '@worknoon/contracts';
import { AiCallRunner } from '../ai/ai-call-runner.js';
import { InjectionDetector } from '../ai/guards/injection-detector.js';
import { ReplyGuard } from '../ai/guards/reply-guard.js';
import { COMPOSE_PROMPT_VERSION, EXTRACT_PROMPT_VERSION } from '../ai/prompts/prompts.js';
import { REFUND_ANALYZER, type RefundAnalyzer } from '../ai/refund-analyzer.js';
import { ApiException } from '../common/api-exception.js';
import { firstName, formatMoney } from '../common/formatting.js';
import { ReplyRenderer } from '../common/reply-renderer.js';
import { daysAgo, instantAfter, wholeDaysBetween } from '../common/time.js';
import { issuesToDetails } from '../common/validation.js';
import { CONTRACTS } from '../config/tokens.js';
import type { Contracts } from '../config/contracts.loader.js';
import {
  lineTotalCents,
  toConversationSummary,
  toDecision,
  toMessage,
} from '../conversations/conversation.presenter.js';
import type { Message, OrderItem } from '../generated/prisma/client.js';
import { evaluatePolicy } from '../policy/engine.js';
import type { PolicyDecision } from '../policy/types.js';
import { normalizeExtraction } from './normalize-extraction.js';
import { RefundsRepository, type ConversationForMessage } from './refunds.repository.js';
import { createSendMessageBodySchema, type SendMessageBody } from './send-message.schema.js';

interface ExtractionStep {
  readonly extraction: Extraction | null;
  readonly calls: readonly AiCall[];
}

interface ReplyStep {
  readonly content: string;
  readonly flags: readonly Flag[];
  readonly calls: readonly AiCall[];
  readonly replyGuard: DecisionTrace['replyGuard'];
}

/**
 * Orchestrates POST /conversations/{id}/messages exactly as docs/pipeline.md describes: load,
 * validate, store, detect, extract, clarify, gather facts, evaluate the policy, compose, guard,
 * persist. Rules decide; the analyzer only reads the message and phrases the answer.
 */
@Injectable()
export class RefundPipelineService {
  private readonly bodySchema: ReturnType<typeof createSendMessageBodySchema>;

  constructor(
    private readonly refunds: RefundsRepository,
    private readonly runner: AiCallRunner,
    private readonly detector: InjectionDetector,
    private readonly replyGuard: ReplyGuard,
    private readonly renderer: ReplyRenderer,
    @Inject(REFUND_ANALYZER) private readonly analyzer: RefundAnalyzer,
    @Inject(CONTRACTS) private readonly contracts: Contracts,
  ) {
    this.bodySchema = createSendMessageBodySchema(contracts.policy);
  }

  async handleMessage(conversationId: string, rawBody: unknown): Promise<SendMessageResponse> {
    // 1. Load.
    const conversation = await this.refunds.findConversationForMessage(conversationId);
    if (conversation === null) throw ApiException.notFound('Conversation not found.');
    if (conversation.status === 'closed') throw this.conversationClosed();

    // 2. Validate.
    const body = this.parseBody(rawBody);
    const selectedItems = this.selectItems(conversation, body.itemIds);

    // One turn at a time: claim the conversation before storing anything or calling the AI.
    const claim = await this.refunds.claimTurn(conversation.id);
    if (!claim.ok) {
      throw claim.reason === 'conversation_closed'
        ? this.conversationClosed()
        : ApiException.conflict(
            'CONVERSATION_BUSY',
            "We're still working on your previous message.",
          );
    }
    try {
      // Re-read under the lock: a turn that finished between the first read and the claim may have
      // added messages or bumped the clarification counter.
      const current = await this.refunds.findConversationForMessage(conversation.id);
      if (current === null || current.status === 'closed') throw this.conversationClosed();
      return await this.runTurn(current, body, selectedItems);
    } finally {
      await this.refunds.releaseTurn(conversation.id, claim.lockedUntil);
    }
  }

  /** Steps 3-11, run while this request holds the conversation's turn lock. */
  private async runTurn(
    conversation: ConversationForMessage,
    body: SendMessageBody,
    selectedItems: OrderItem[],
  ): Promise<SendMessageResponse> {
    // 3. Store the customer message.
    const customerMessage = await this.refunds.storeCustomerMessage(
      conversation.id,
      body.text,
      body.itemIds,
    );
    const customerTexts = [...conversation.messages.map((message) => message.content), body.text];

    // 4. Heuristic injection detector over every customer message.
    const heuristicMatches = this.detector.detect(customerTexts);

    // 5. Extract.
    const now = new Date();
    const deliveredAt = conversation.order.deliveredAt;
    const daysSinceDelivery = deliveredAt === null ? null : wholeDaysBetween(deliveredAt, now);
    const { extraction, calls: extractCalls } = await this.extract(
      conversation,
      customerTexts,
      body.text,
      selectedItems,
      daysSinceDelivery,
    );

    // 6. Clarify.
    const policy = this.contracts.policy;
    let clarificationTurns = conversation.clarificationTurns;
    let clarificationExhausted = false;
    const injectionSignal = heuristicMatches.length > 0 || extraction?.injectionSuspected === true;
    const needsClarification =
      extraction !== null &&
      !injectionSignal &&
      (extraction.reasonCategory === 'unclear' || extraction.confidence < policy.minAiConfidence);
    if (needsClarification) {
      const turns = await this.refunds.incrementClarificationTurns(conversation.id);
      if (turns === null) throw this.conversationClosed();
      clarificationTurns = turns;
      if (turns < policy.maxClarificationTurns) {
        return this.askForClarification(conversation, customerMessage, selectedItems, turns);
      }
      clarificationExhausted = true;
    }

    // 7. Facts.
    const selectedIds = selectedItems.map((item) => item.id);
    const [refundStates, recentApprovedRefunds] = await Promise.all([
      this.refunds.itemRefundStates(selectedIds),
      this.refunds.countApprovedSince(
        conversation.customerId,
        daysAgo(now, policy.suspiciousRefundLookbackDays),
      ),
    ]);
    const amountCents = selectedItems.reduce((sum, item) => sum + lineTotalCents(item), 0);

    // 8. Policy engine.
    const decision = evaluatePolicy({
      config: policy,
      verifiedCustomerId: conversation.customerId,
      orderCustomerId: conversation.order.customerId,
      orderStatus: conversation.order.status,
      daysSinceDelivery,
      items: selectedItems.map((item) => ({
        id: item.id,
        finalSale: item.finalSale,
        lineTotalCents: lineTotalCents(item),
        refundStatus: refundStates.get(item.id) ?? null,
      })),
      amountCents,
      recentApprovedRefunds,
      extraction,
      heuristicMatches,
      clarificationExhausted,
    });

    // 9-10. Compose and guard the reply.
    const reply = await this.composeReply(
      conversation,
      selectedItems,
      decision,
      amountCents,
      extraction,
    );

    const flags = [
      ...new Set<Flag>([
        ...decision.flags,
        ...(clarificationExhausted ? (['CLARIFICATION_EXHAUSTED'] as const) : []),
        ...reply.flags,
      ]),
    ].sort();
    const trace: DecisionTrace = {
      policyVersion: policy.version,
      evaluatedAt: now.toISOString(),
      facts: {
        orderStatus: conversation.order.status,
        daysSinceDelivery,
        amountCents,
        recentApprovedRefunds,
        finalSaleItemIds: selectedItems.filter((item) => item.finalSale).map((item) => item.id),
        alreadyRefundedItemIds: selectedIds.filter((id) => refundStates.has(id)),
      },
      rules: [...decision.rules],
      extraction,
      heuristicMatches,
      flags,
      clarificationTurns,
      ai: {
        provider: this.analyzer.provider,
        model: this.analyzer.model,
        promptVersions: { extract: EXTRACT_PROMPT_VERSION, compose: COMPOSE_PROMPT_VERSION },
        calls: [...extractCalls, ...reply.calls],
      },
      replyGuard: reply.replyGuard,
    };

    // 11. Persist.
    const persisted = await this.refunds.persistDecision({
      conversationId: conversation.id,
      customerId: conversation.customerId,
      orderId: conversation.orderId,
      status: decision.status,
      reasonCategory: extraction?.reasonCategory ?? null,
      amountCents,
      currency: policy.currency,
      decisiveRuleIds: decision.decisiveRuleIds,
      flags,
      trace,
      items: selectedItems.map((item) => ({
        orderItemId: item.id,
        amountCents: lineTotalCents(item),
      })),
      previouslyClaimedItemIds: [...refundStates.keys()],
      reply: { content: reply.content, createdAt: instantAfter(customerMessage.createdAt) },
    });
    if (!persisted.ok) {
      throw persisted.reason === 'conversation_closed'
        ? this.conversationClosed()
        : ApiException.conflict(
            'REFUND_ALREADY_EXISTS',
            'A refund request already covers one of these items.',
          );
    }

    const replyMessage = toMessage(persisted.reply);
    return {
      conversation: toConversationSummary(persisted.conversation),
      messages: [toMessage(customerMessage), replyMessage],
      reply: replyMessage,
      decision: toDecision(persisted.refundRequest, this.renderer),
    };
  }

  private parseBody(rawBody: unknown): SendMessageBody {
    const result = this.bodySchema.safeParse(rawBody ?? {});
    if (!result.success) throw ApiException.validation(issuesToDetails(result.error.issues));
    return result.data;
  }

  /**
   * Every selected id must belong to the conversation's order. The result keeps the order's item
   * order (sku, then id), so item names and trace ids read the same in both backends.
   */
  private selectItems(
    conversation: ConversationForMessage,
    itemIds: readonly string[],
  ): OrderItem[] {
    const orderItemIds = new Set(conversation.order.items.map((item) => item.id));
    if (itemIds.some((id) => !orderItemIds.has(id))) {
      throw ApiException.validation([
        { field: 'itemIds', message: "Every item must belong to this conversation's order." },
      ]);
    }
    const selected = new Set(itemIds);
    return conversation.order.items.filter((item) => selected.has(item.id));
  }

  private async extract(
    conversation: ConversationForMessage,
    customerTexts: readonly string[],
    latestMessage: string,
    selectedItems: readonly OrderItem[],
    daysSinceDelivery: number | null,
  ): Promise<ExtractionStep> {
    const outcome = await this.runner.run(this.analyzer, 'extract', EXTRACT_PROMPT_VERSION, () =>
      this.analyzer.extract({
        customerMessages: customerTexts,
        latestMessage,
        order: {
          orderNumber: conversation.order.orderNumber,
          status: conversation.order.status,
          daysSinceDelivery,
          selectedItems: selectedItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            finalSale: item.finalSale,
          })),
        },
      }),
    );
    return {
      extraction: outcome.value === null ? null : normalizeExtraction(outcome.value),
      calls: outcome.calls,
    };
  }

  private async askForClarification(
    conversation: ConversationForMessage,
    customerMessage: Message,
    selectedItems: readonly OrderItem[],
    clarificationTurns: number,
  ): Promise<SendMessageResponse> {
    const content = this.renderer.clarify(
      firstName(conversation.customer.name),
      selectedItems.map((item) => item.name),
    );
    const reply = await this.refunds.saveClarificationReply(
      conversation.id,
      content,
      instantAfter(customerMessage.createdAt),
      clarificationTurns,
    );
    const replyMessage = toMessage(reply);
    return {
      conversation: toConversationSummary({ ...conversation, clarificationTurns }),
      messages: [toMessage(customerMessage), replyMessage],
      reply: replyMessage,
      decision: null,
    };
  }

  /**
   * Asks the analyzer to phrase the decision (one retry), then runs the reply guard. Any failure
   * falls back to the template for the outcome, so the customer always gets a correct reply.
   */
  private async composeReply(
    conversation: ConversationForMessage,
    selectedItems: readonly OrderItem[],
    decision: PolicyDecision,
    amountCents: number,
    extraction: Extraction | null,
  ): Promise<ReplyStep> {
    const amount = formatMoney(amountCents);
    const values = {
      firstName: firstName(conversation.customer.name),
      itemNames: selectedItems.map((item) => item.name),
      amount,
      customerReasons:
        decision.status === 'denied' ? this.renderer.customerReasons(decision.decisiveRuleIds) : [],
    };
    const template = this.renderer.outcome(decision.status, values);

    const composed = await this.runner.run(this.analyzer, 'compose', COMPOSE_PROMPT_VERSION, () =>
      this.analyzer.compose({
        outcome: decision.status,
        ...values,
        summary: extraction?.summary ?? null,
      }),
    );
    if (composed.value === null) {
      return {
        content: template,
        flags: ['COMPOSE_UNAVAILABLE'],
        calls: composed.calls,
        replyGuard: { passed: true, violations: [], usedTemplate: true },
      };
    }

    const violations = this.replyGuard.check({
      reply: composed.value,
      status: decision.status,
      amount,
    });
    const passed = violations.length === 0;
    return {
      content: passed ? composed.value : template,
      flags: passed ? [] : ['REPLY_GUARD_FALLBACK'],
      calls: composed.calls,
      replyGuard: { passed, violations, usedTemplate: !passed },
    };
  }

  private conversationClosed(): ApiException {
    return ApiException.conflict('CONVERSATION_CLOSED', 'This conversation is closed.');
  }
}
