<?php

declare(strict_types=1);

namespace App\Actions;

use App\Ai\AiCallRunner;
use App\Ai\Contracts\RefundAnalyzer;
use App\Ai\Guards\InjectionDetector;
use App\Ai\Guards\ReplyGuard;
use App\Ai\Prompts\PromptLibrary;
use App\Data\ComposeInput;
use App\Data\DecisionTrace;
use App\Data\Extraction;
use App\Data\ExtractionInput;
use App\Data\MessageOutcome;
use App\Data\OrderContext;
use App\Data\ReplyGuardResult;
use App\Data\SelectedItems;
use App\Data\SendMessageData;
use App\Data\TraceFacts;
use App\Domain\Refunds\Policy\PolicyConfig;
use App\Domain\Refunds\Policy\PolicyContext;
use App\Domain\Refunds\Policy\PolicyDecision;
use App\Domain\Refunds\Policy\PolicyEngine;
use App\Domain\Refunds\Support\CustomerReason;
use App\Domain\Refunds\Support\Money;
use App\Domain\Refunds\Support\Names;
use App\Domain\Refunds\Support\TemplateRenderer;
use App\Enums\AiStep;
use App\Enums\ConversationStatus;
use App\Enums\DecidedBy;
use App\Enums\Flag;
use App\Enums\MessageRole;
use App\Enums\OrderStatus;
use App\Enums\ReasonCategory;
use App\Enums\RefundStatus;
use App\Exceptions\ConversationClosed;
use App\Exceptions\RefundAlreadyExists;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\RefundRequest;
use App\Models\RefundRequestItem;
use App\Queries\ItemRefundStates;
use App\Support\AuditLog;
use App\Support\ConversationTurnLock;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * The refund pipeline for one customer turn (docs/pipeline.md, POST /conversations/{id}/messages):
 * store, detect, extract, clarify, gather facts, apply policy, compose, guard, persist.
 *
 * Rules decide; the model only classifies the message and words the reply.
 */
final readonly class HandleRefundMessage
{
    public function __construct(
        private RefundAnalyzer $analyzer,
        private AiCallRunner $ai,
        private InjectionDetector $injectionDetector,
        private ReplyGuard $replyGuard,
        private TemplateRenderer $templates,
        private PolicyEngine $policy,
        private PolicyConfig $config,
        private ItemRefundStates $refundStates,
        private AuditLog $audit,
        private ConversationTurnLock $turnLock,
    ) {}

    public function __invoke(Conversation $conversation, SendMessageData $data): MessageOutcome
    {
        // 2b. One turn at a time: claim the conversation before anything is stored or sent to the model.
        $claim = $this->turnLock->claim($conversation);

        try {
            // Re-read under the lock: a turn that finished between route binding and the claim may
            // have bumped the clarification counter.
            $conversation->refresh();

            return $this->handle($conversation, $data);
        } finally {
            $this->turnLock->release($conversation, $claim);
        }
    }

    private function handle(Conversation $conversation, SendMessageData $data): MessageOutcome
    {
        $conversation->loadMissing(['customer', 'order.items']);
        $order = $conversation->order;
        $selectedItems = $this->selectedItems($order, $data->itemIds);
        $now = CarbonImmutable::now();

        // 3. Store the customer message.
        $customerMessage = Message::query()->create([
            'conversation_id' => $conversation->id,
            'role' => MessageRole::Customer,
            'content' => $data->text,
            'item_ids' => $data->itemIds,
        ]);

        // 4. Heuristic detector over every customer message in the conversation.
        $customerTexts = $this->customerTexts($conversation);
        $heuristicMatches = $this->injectionDetector->detect($customerTexts);

        // 5. Extract (retry once; null when both attempts fail).
        $daysSinceDelivery = $this->daysSinceDelivery($order, $now);
        $extractCall = $this->ai->run(AiStep::Extract, PromptLibrary::EXTRACT_VERSION, fn () => $this->analyzer->extract(
            new ExtractionInput(
                customerMessages: $customerTexts,
                latestMessage: $data->text,
                orderContext: new OrderContext(
                    orderNumber: $order->order_number,
                    status: $order->status,
                    daysSinceDelivery: $daysSinceDelivery,
                    selectedItems: $selectedItems->contextItems(),
                ),
            ),
        ));
        $extraction = $extractCall->result?->extraction;

        // 6. Clarify, at most maxClarificationTurns - 1 times, and never when injection is suspected.
        $pipelineFlags = [];
        $clarificationTurns = $conversation->clarification_turns;

        if ($this->needsClarification($extraction, $heuristicMatches)) {
            $clarificationTurns++;

            if ($clarificationTurns < $this->config->maxClarificationTurns) {
                return $this->askForClarification($conversation, $customerMessage, $selectedItems, $clarificationTurns);
            }

            $pipelineFlags[] = Flag::ClarificationExhausted;
        }

        // 7. Facts, from the database only.
        $selectedIds = $selectedItems->ids();
        $amountCents = $selectedItems->amountCents();
        $facts = new TraceFacts(
            orderStatus: $order->status,
            daysSinceDelivery: $daysSinceDelivery,
            amountCents: $amountCents,
            recentApprovedRefunds: $this->recentApprovedRefunds($conversation->customer_id, $now),
            finalSaleItemIds: $selectedItems->finalSaleIds(),
            alreadyRefundedItemIds: $this->refundStates->blocked($selectedIds),
        );

        // 8. Policy engine.
        $decision = $this->policy->evaluate(new PolicyContext(
            config: $this->config,
            verifiedCustomerId: $conversation->customer_id,
            orderCustomerId: $order->customer_id,
            orderStatus: $order->status,
            daysSinceDelivery: $daysSinceDelivery,
            amountCents: $amountCents,
            selectedItemIds: $selectedIds,
            finalSaleItemIds: $facts->finalSaleItemIds,
            alreadyRefundedItemIds: $facts->alreadyRefundedItemIds,
            recentApprovedRefunds: $facts->recentApprovedRefunds,
            aiAvailable: $extraction !== null,
            reasonCategory: $extraction?->reasonCategory,
            claimsConflict: $extraction !== null && $extraction->claimsConflict,
            injectionSuspected: $extraction !== null && $extraction->injectionSuspected,
            confidence: $extraction?->confidence,
            heuristicMatches: $heuristicMatches,
            clarificationExhausted: in_array(Flag::ClarificationExhausted, $pipelineFlags, true),
        ));

        // 9 and 10. Compose the reply, then guard it; fall back to the template on any failure.
        $firstName = Names::firstName($conversation->customer->name);
        $itemNames = $selectedItems->names();
        $customerReasons = $decision->status === RefundStatus::Denied
            ? CustomerReason::sentences($decision->decisiveRuleIds, $this->config)
            : [];
        $amount = Money::format($amountCents);

        $composeCall = $this->ai->run(AiStep::Compose, PromptLibrary::COMPOSE_VERSION, fn () => $this->analyzer->compose(
            new ComposeInput($decision->status, $amount, $firstName, $itemNames, $customerReasons, $extraction?->summary),
        ));

        $template = $this->templates->render($decision->status->value, [
            'firstName' => $firstName,
            'itemNames' => Names::join($itemNames),
            'amount' => $amount,
            'customerReason' => implode(' ', $customerReasons),
        ]);

        $composed = $composeCall->result?->text;
        $guard = $composed === null
            ? new ReplyGuardResult([])
            : $this->replyGuard->check($composed, $decision->status, $amount);
        $usedTemplate = $composed === null || ! $guard->passed();

        if ($composed === null) {
            $pipelineFlags[] = Flag::ComposeUnavailable;
        } elseif (! $guard->passed()) {
            $pipelineFlags[] = Flag::ReplyGuardFallback;
        }

        $reply = $usedTemplate ? $template : $composed;

        $flags = [...$decision->flags, ...$pipelineFlags];

        $trace = new DecisionTrace(
            policyVersion: $this->config->version,
            evaluatedAt: $now,
            facts: $facts,
            rules: $decision->results,
            extraction: $extraction,
            heuristicMatches: $heuristicMatches,
            flags: $flags,
            clarificationTurns: $clarificationTurns,
            provider: $this->analyzer->provider(),
            model: $this->analyzer->model(),
            promptVersions: PromptLibrary::versions(),
            calls: [...$extractCall->attempts, ...$composeCall->attempts],
            replyGuard: $guard,
            usedTemplate: $usedTemplate,
        );

        // 11. Persist atomically.
        return $this->persistDecision(
            $conversation, $customerMessage, $selectedItems, $decision, $extraction?->reasonCategory,
            Flag::normalize($flags), $facts, $trace, $reply, $clarificationTurns,
        );
    }

    /**
     * Selected items ordered by sku, then id (the order of Order::items(), sorted by the database like
     * everywhere else), whatever order the customer picked them in.
     *
     * @param  list<string>  $itemIds
     */
    private function selectedItems(Order $order, array $itemIds): SelectedItems
    {
        return new SelectedItems(array_values(array_filter(
            $order->items->all(),
            static fn (OrderItem $item): bool => in_array($item->id, $itemIds, true),
        )));
    }

    /**
     * @return list<string>
     */
    private function customerTexts(Conversation $conversation): array
    {
        /** @var list<string> */
        return $conversation->messages()
            ->where('role', MessageRole::Customer)
            ->pluck('content')
            ->all();
    }

    /**
     * Whole days since delivery: floor((now - deliveredAt) / 24h), or null when not delivered.
     */
    private function daysSinceDelivery(Order $order, CarbonImmutable $now): ?int
    {
        if ($order->status !== OrderStatus::Delivered || $order->delivered_at === null) {
            return null;
        }

        $seconds = (float) $now->format('U.u') - (float) $order->delivered_at->format('U.u');

        return (int) floor($seconds / 86_400);
    }

    /**
     * @param  list<string>  $heuristicMatches
     */
    private function needsClarification(?Extraction $extraction, array $heuristicMatches): bool
    {
        if ($extraction === null || $heuristicMatches !== [] || $extraction->injectionSuspected) {
            return false;
        }

        return $extraction->reasonCategory === ReasonCategory::Unclear
            || $extraction->confidence < $this->config->minAiConfidence;
    }

    private function recentApprovedRefunds(string $customerId, CarbonImmutable $now): int
    {
        return RefundRequest::query()
            ->where('customer_id', $customerId)
            ->where('status', RefundStatus::Approved)
            ->where('created_at', '>=', $now->subDays($this->config->suspiciousRefundLookbackDays))
            ->count();
    }

    private function askForClarification(
        Conversation $conversation,
        Message $customerMessage,
        SelectedItems $selectedItems,
        int $clarificationTurns,
    ): MessageOutcome {
        $content = $this->templates->render('clarify', [
            'firstName' => Names::firstName($conversation->customer->name),
            'itemNames' => Names::join($selectedItems->names()),
        ]);

        return DB::transaction(function () use ($conversation, $customerMessage, $content, $clarificationTurns): MessageOutcome {
            $locked = $this->lockOpenConversation($conversation);
            $locked->update(['clarification_turns' => $clarificationTurns]);

            $reply = Message::query()->create([
                'conversation_id' => $locked->id,
                'role' => MessageRole::Assistant,
                'content' => $content,
                'item_ids' => null,
            ]);

            $this->audit->record('conversation.clarification_requested', AuditLog::ACTOR_SYSTEM, [
                'clarificationTurns' => $clarificationTurns,
            ], conversationId: $locked->id);

            return new MessageOutcome($locked, $customerMessage, $reply, null);
        });
    }

    /**
     * @param  list<string>  $flags
     */
    private function persistDecision(
        Conversation $conversation,
        Message $customerMessage,
        SelectedItems $selectedItems,
        PolicyDecision $decision,
        ?ReasonCategory $reasonCategory,
        array $flags,
        TraceFacts $facts,
        DecisionTrace $trace,
        string $replyText,
        int $clarificationTurns,
    ): MessageOutcome {
        try {
            return DB::transaction(function () use (
                $conversation, $customerMessage, $selectedItems, $decision, $reasonCategory, $flags, $facts, $trace, $replyText, $clarificationTurns
            ): MessageOutcome {
                $locked = $this->lockOpenConversation($conversation);
                $this->ensureItemsUnclaimed($selectedItems->ids(), $facts->alreadyRefundedItemIds);

                $refundRequest = RefundRequest::query()->create([
                    'conversation_id' => $locked->id,
                    'customer_id' => $locked->customer_id,
                    'order_id' => $locked->order_id,
                    'status' => $decision->status,
                    'decided_by' => DecidedBy::Policy,
                    'reason_category' => $reasonCategory,
                    'amount_cents' => $facts->amountCents,
                    'currency' => $this->config->currency,
                    'decisive_rule_ids' => $decision->decisiveRuleIds,
                    'flags' => $flags,
                    'trace' => $trace->toArray(),
                ]);

                foreach ($selectedItems->items as $item) {
                    RefundRequestItem::query()->create([
                        'refund_request_id' => $refundRequest->id,
                        'order_item_id' => $item->id,
                        'amount_cents' => $item->lineTotalCents(),
                    ]);
                }

                $reply = Message::query()->create([
                    'conversation_id' => $locked->id,
                    'role' => MessageRole::Assistant,
                    'content' => $replyText,
                    'item_ids' => null,
                ]);

                $locked->update([
                    'status' => ConversationStatus::Closed,
                    'clarification_turns' => $clarificationTurns,
                ]);

                $this->audit->record('refund.decided', AuditLog::ACTOR_SYSTEM, [
                    'status' => $decision->status->value,
                    'decisiveRuleIds' => $decision->decisiveRuleIds,
                    'flags' => $flags,
                    'amountCents' => $facts->amountCents,
                ], conversationId: $locked->id, refundRequestId: $refundRequest->id);

                return new MessageOutcome($locked, $customerMessage, $reply, $refundRequest);
            });
        } catch (UniqueConstraintViolationException) {
            throw new RefundAlreadyExists;
        }
    }

    private function lockOpenConversation(Conversation $conversation): Conversation
    {
        $locked = Conversation::query()->lockForUpdate()->findOrFail($conversation->id);

        if ($locked->isClosed()) {
            throw new ConversationClosed;
        }

        return $locked;
    }

    /**
     * Another request may have claimed one of the items while the model was working.
     *
     * @param  list<string>  $itemIds
     * @param  list<string>  $knownBlocked  items that were already blocked when the facts were read
     */
    private function ensureItemsUnclaimed(array $itemIds, array $knownBlocked): void
    {
        // Serialise concurrent decisions on the same items.
        OrderItem::query()->whereIn('id', $itemIds)->orderBy('id')->lockForUpdate()->pluck('id');

        if (array_diff($this->refundStates->blocked($itemIds), $knownBlocked) !== []) {
            throw new RefundAlreadyExists;
        }
    }
}
