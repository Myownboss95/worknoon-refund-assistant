# Refund pipeline specification

Both backends implement this exactly. `contracts/openapi.yaml` defines the wire shapes; this file
defines behaviour. The contract suite in `tests/contract` checks both.

## Shared files (read at boot)

| File | Used for |
|---|---|
| `contracts/policy.config.json` | Thresholds, reason sets, customer-safe deny reasons |
| `contracts/scenarios.json` | Seed data |
| `contracts/mock-llm-fixtures.json` | Mock analyzer |
| `contracts/injection-patterns.json` | Heuristic injection detector |
| `contracts/reply-guard.json` | Reply guard |
| `contracts/reply-templates.json` | Mock composer, fallbacks, greeting, clarify, human review messages |
| `contracts/prompts/extract.v1.md`, `compose.v1.md` | System prompts for the real model |
| `contracts/extraction.schema.json` | Structured output schema |
| `policy/refund-policy.md` | Returned by `GET /policy`; rule semantics |

Paths come from env: `CONTRACTS_PATH` (default: repo `contracts/` resolved relative to the app) and
`POLICY_DOC_PATH` (default: repo `policy/refund-policy.md`). In Docker both are copied into the image.

## Data model

snake_case columns in both databases (Prisma maps to camelCase in code). All ids are UUIDs. All
timestamps are UTC `timestamptz`.

- `customers`: id, name, email (unique, lowercase), created_at
- `orders`: id, customer_id, order_number (unique), status (`processing|shipped|delivered`),
  placed_at, delivered_at (nullable), created_at
- `order_items`: id, order_id, sku, name, unit_price_cents (int), quantity (int), final_sale (bool)
- `conversations`: id, customer_id, order_id, status (`open|closed`), clarification_turns (int, default 0),
  created_at, updated_at
- `messages`: id, conversation_id, role (`customer|assistant|system`), content (text), item_ids (json array
  of order item ids, customer messages only, else null), created_at
- `refund_requests`: id, conversation_id (nullable: null for imported history), customer_id, order_id,
  status (`approved|denied|escalated`), decided_by (`policy|human|import`), reason_category (nullable),
  amount_cents, currency, decisive_rule_ids (json), flags (json, sorted array), trace (json, nullable for
  imports), review_decision (nullable `approve|deny`), review_note, reviewed_by, reviewed_at, created_at, updated_at
- `refund_request_items`: id, refund_request_id, order_item_id, amount_cents
- `audit_events`: id, type, actor, conversation_id (nullable), refund_request_id (nullable), data (json), created_at

### Seeding

- Seed runs on boot only when `customers` is empty (idempotent). `POST /admin/demo/reset` truncates all
  tables and re-seeds.
- For each customer and order in `scenarios.json`: `placed_at = now - placedDaysAgo days`,
  `delivered_at = now - deliveredDaysAgo days` (null when `deliveredDaysAgo` is null).
- Each `refundHistory` entry becomes a `refund_requests` row with `conversation_id = null`,
  `decided_by = import`, the given status and reason, `amount_cents` = the item's price × quantity,
  `created_at = now - daysAgo days`, `decisive_rule_ids = []`, `flags = []`, `trace = null`, plus one
  `refund_request_items` row.

## Item refund state

An order item's `refundStatus` (returned by verify and conversation endpoints) is:
`approved` if any approved refund request covers it, else `pending` if any escalated one covers it,
else `null`. Denied requests do not block a new attempt.

## POST /customers/verify

1. Validate: `email` valid email (≤ 254), `orderNumber` matches `^[A-Za-z0-9-]{3,32}$`. Normalise email to
   lowercase and trim; normalise order number to uppercase and trim.
2. Find the order by number whose customer has that email. If there is no match for any reason, return
   `404 VERIFICATION_FAILED` with message `We couldn't find an order matching those details.` and
   record an audit event `verification.failed` with the masked email (for example `a***@example.com`).
3. Create a conversation (status `open`), store the greeting as an assistant message (template
   `greeting`), record audit event `conversation.started`, return `201` with `VerifyResponse`.

Rate limit: `RATE_LIMIT_VERIFY_PER_MINUTE` (default 60) per IP. Returns `429 RATE_LIMITED`.

## POST /conversations/{id}/messages

Rate limit: `RATE_LIMIT_MESSAGES_PER_MINUTE` (default 60) per IP.

1. **Load.** Unknown or non-UUID id: `404 NOT_FOUND`. Status `closed`: `409 CONVERSATION_CLOSED`.
2. **Validate.** `text`: string; strip control characters except `\n` and `\t`; trim; 1..`maxMessageLength`
   (1000) characters after stripping. `itemIds`: 1..`maxItemsPerRequest` unique UUIDs. Every id must belong
   to the conversation's order, else `422 VALIDATION_FAILED` with detail field `itemIds`.
3. **Store** the customer message with its item ids.
4. **Heuristic detector.** Run every pattern in `injection-patterns.json` over every customer message in the
   conversation (including this one). Collect the ids of matching patterns (`heuristicMatches`, sorted, unique).
5. **Extract.** Call `analyzer.extract(input)` where input includes all customer messages in order, the
   latest message, and the order context (order number, status, days since delivery or null, selected
   items with names and final sale flags). On error (timeout 20 s, provider error, output that fails the
   schema) retry once. If it fails twice, `extraction = null`, and add a failed call entry to the trace.
   Post-process a successful extraction: clamp confidence to [0, 1], truncate summary to 280 characters.
6. **Clarify.** If `extraction != null` AND no injection signal (no heuristic matches and
   `injectionSuspected = false`) AND (`reasonCategory = unclear` OR `confidence < minAiConfidence`):
   - increment `clarification_turns`;
   - if `clarification_turns < maxClarificationTurns` (2): store an assistant message rendered from template
     `clarify`, record audit event `conversation.clarification_requested`, and return `200` with
     `decision: null`, conversation still `open`. **Stop here.**
   - otherwise add flag `CLARIFICATION_EXHAUSTED` and continue.
7. **Facts.** From the database: order, customer, selected items, refund state of each selected item,
   `recentApprovedRefunds` = count of approved refund requests for this customer with `created_at` within
   `suspiciousRefundLookbackDays` of now. Amount = Σ unit_price_cents × quantity over selected items.
8. **Policy engine.** Evaluate R01..R10 per `policy/refund-policy.md`, in order, each returning
   `{ ruleId, outcome, reason }` where `reason` is a short internal English sentence (for the admin trace).
   Combine with precedence deny > escalate > approve > fallback escalate. Collect R07 flags.
   Flags on the request = R07 flags ∪ pipeline flags, sorted alphabetically, unique.
9. **Compose.** If the analyzer is the mock, render the template for the outcome. Otherwise call
   `analyzer.compose(input)` with outcome, amount (formatted), first name, item names, customer-safe
   reasons (denied only) and the extraction summary. Retry once on error; on second failure use the
   template and add flag `COMPOSE_UNAVAILABLE`.
10. **Reply guard.** Apply `reply-guard.json`. On any violation use the template, add flag
    `REPLY_GUARD_FALLBACK`, and record the violations in the trace.
11. **Persist** in one transaction: refund request (+ items with each item's line amount), assistant message,
    conversation `closed`, audit event `refund.decided` (actor `system`, data: status, decisiveRuleIds,
    flags, amountCents). Return `200` with the decision.

Concurrency: if a unique violation or a race means one of the items was claimed by another request in the
meantime, return `409 REFUND_ALREADY_EXISTS`.

### Formatting helpers (identical in both backends)

- `formatMoney(cents)`: `$` + integer dollars with comma thousands separators + `.` + two-digit cents.
  `129900 → $1,299.00`, `8900 → $89.00`, `5 → $0.05`.
- `joinNames(names)`: 1 → `A`; 2 → `A and B`; 3+ → `A, B and C`.
- `firstName(name)`: text before the first space.
- `maskEmail(email)`: first character of the local part + `***@` + domain.

### Decision trace (stored as JSON, returned by admin detail)

```json
{
  "policyVersion": "1.0",
  "evaluatedAt": "2026-09-25T10:00:00.000Z",
  "facts": {
    "orderStatus": "delivered",
    "daysSinceDelivery": 5,
    "amountCents": 8900,
    "recentApprovedRefunds": 0,
    "finalSaleItemIds": [],
    "alreadyRefundedItemIds": []
  },
  "rules": [{ "ruleId": "R01", "outcome": "pass", "reason": "Order belongs to the verified customer" }],
  "extraction": { "reasonCategory": "damaged", "itemsMentioned": [], "claimsConflict": false,
                  "injectionSuspected": false, "summary": "…", "confidence": 0.93 },
  "heuristicMatches": [],
  "flags": [],
  "clarificationTurns": 0,
  "ai": {
    "provider": "mock",
    "model": "mock",
    "promptVersions": { "extract": "extract.v1", "compose": "compose.v1" },
    "calls": [
      { "step": "extract", "attempt": 1, "ok": true, "latencyMs": 3, "inputTokens": 0, "outputTokens": 0, "error": null },
      { "step": "compose", "attempt": 1, "ok": true, "latencyMs": 0, "inputTokens": 0, "outputTokens": 0, "error": null }
    ]
  },
  "replyGuard": { "passed": true, "violations": [], "usedTemplate": false }
}
```

`extraction` is `null` when the AI was unavailable. In mock mode the compose call entry is still recorded.
`error` is a short code (`timeout`, `provider_error`, `invalid_output`), never a raw provider message.

## Human review: POST /admin/refund-requests/{id}/review

Body `{ decision: "approve" | "deny", note: string 3..1000 }`. Only when status is `escalated`; otherwise
`409 REFUND_NOT_REVIEWABLE`. Sets status (`approved`/`denied`), `decided_by = human`, review fields
(`reviewed_by = "admin"`), appends a system message to the conversation (templates `humanApproved` /
`humanDenied`), records audit event `refund.reviewed` (actor `admin`, data: decision, note). Returns
the updated detail.

## Admin

All `/admin/*` routes require header `X-Admin-Token` equal to `ADMIN_TOKEN` (constant-time compare),
else `401 ADMIN_UNAUTHORIZED`. Admin list and stats only include requests created by the assistant
(`conversation_id IS NOT NULL`); imported history is excluded. List order: `created_at` desc, then id.

Stats: `total` = count; `byStatus` = counts of current status; `escalatedTotal` = count ever escalated
(current status escalated, or decided_by human); `humanReviewed` = decided_by human; `escalationRate` =
`escalatedTotal / total` rounded to 4 decimals (0 when total is 0); `autoResolutionRate` =
count(decided_by policy and status approved or denied) / total, rounded to 4 decimals.

## Health

`GET /health` returns 200 with `status: ok` when the database answers `SELECT 1`, else 503 with
`status: degraded` and `database: down`.

## Logging

One structured log line per AI call: step, provider, model, prompt version, latency, tokens, ok, error code.
Never log message text, prompts, API keys, or unmasked emails.

## Errors

All errors use `{ "error": { "code": "...", "message": "...", "details": [...] } }`; `details` is present only
for `VALIDATION_FAILED` and is an array of `{ field, message }` with camelCase field names. Unknown routes
return `404 NOT_FOUND`. Unhandled exceptions return `500 INTERNAL_ERROR` with a generic message.

## Clarifications (pinned so both backends match byte for byte)

- **Item order.** Order items are always returned sorted by `sku` ascending, then `id`. Refund request
  items in admin detail use the same order.
- **`Decision.customerReason`** exact strings:
  - approved: `Your refund of {amount} has been approved.`
  - escalated: `A member of our support team will review your request within one business day.`
  - denied by policy: the `customerReasons` sentences for the decisive rules (placeholders filled),
    joined with one space; if that is empty, the human-denied sentence below.
  - denied by a human: `After reviewing your request, we're unable to offer a refund.`
- **Human review keeps the policy record.** `decisiveRuleIds`, `flags` and `trace` stay exactly as the
  policy engine wrote them; only `status`, `decidedBy` and the review fields change.
- **R08** returns `approve` only when the reason is merchant fault and the order is delivered within the
  refund window; otherwise `not_applicable`. (R03 already denies outside the window, so the outcome is
  the same either way; this only affects the trace.)
- **`LOW_CONFIDENCE`** fires when the extraction exists and confidence < `minAiConfidence`, or the reason
  is still `unclear` when the clarification limit is reached.
- **Wrong HTTP method** on a known path returns `404 NOT_FOUND`. Other 4xx conditions without a specific
  code (e.g. malformed JSON) return `422 VALIDATION_FAILED`.
