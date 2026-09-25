# Refund Policy v1.0

This is the policy the refund assistant enforces. Rule IDs here match the rule classes in both
backends (`app/Domain/Refunds/Policy/Rules` in Laravel, `src/policy/rules` in NestJS) and the
`ruleId` values stored in every decision trace.

Thresholds are not hard-coded. They live in [`contracts/policy.config.json`](../contracts/policy.config.json),
which both backends read at boot. Changing a number there changes the policy without touching rule code.

## Principle

**Rules decide. AI understands and explains.** The language model only turns the customer's message
into structured signals (reason category, conflict flag, injection flag, confidence). It never
produces an amount or a decision. The amount always comes from the order data in the database.

## Rules

Every rule is evaluated for every request and returns one of:

| Outcome | Meaning |
|---|---|
| `pass` | The rule has no objection |
| `not_applicable` | The rule does not apply to this request (for example, R03 on an undelivered order) |
| `deny` | The request must be denied |
| `escalate` | A human must review the request |
| `approve` | The rule supports automatic approval |

| ID | Rule | Outcome |
|---|---|---|
| R01 | The order must belong to the verified customer. | `deny` otherwise |
| R02 | The order must be delivered. Processing or shipped orders are directed to cancellation. | `deny` if not delivered |
| R03 | Refund window is `refundWindowDays` (30) days from delivery. | `deny` if more than 30 whole days have passed; `not_applicable` if not delivered |
| R04 | Final sale items are not refundable. | `deny` if any selected item is final sale, **unless** the reason is a merchant-fault reason (`damaged`, `defective`, `wrong_item`) or unknown (AI unavailable), in which case `escalate` |
| R05 | An item can only be refunded once. | `deny` if any selected item already has an approved refund or a pending (escalated) request |
| R06 | Refund totals above `humanReviewThresholdCents` ($500.00) need human review. | `escalate` if the total of the selected items is strictly greater than $500.00 |
| R07 | Suspicious signals need human review. | `escalate` if any of: `suspiciousRefundCount` (3) or more approved refunds for this customer in the last `suspiciousRefundLookbackDays` (90) days; the claim conflicts with order data; prompt injection suspected (heuristic or model); AI confidence below `minAiConfidence` (0.6); AI unavailable |
| R08 | Damaged, defective or wrong item, within the window. | `approve` if the reason is `damaged`, `defective` or `wrong_item` and the order is delivered |
| R09 | Change of mind within `changeOfMindWindowDays` (14) days of delivery. | `approve` if the reason is `changed_mind` and delivery was at most 14 days ago; `deny` if more than 14 days ago; `not_applicable` if not delivered or another reason |
| R10 | Only the reasons above can be approved automatically. | `escalate` if the reason is not one of `approvableReasons` (for example `not_received`, `other`, `unclear`, or unknown because the AI was unavailable) |

### Precedence

1. If any rule returns `deny`, the request is **denied**.
2. Otherwise, if any rule returns `escalate`, the request is **escalated** to a human.
3. Otherwise, if any rule returns `approve`, the request is **approved**.
4. Otherwise the request is **escalated** (fail safe). With R10 in place this branch is unreachable, but both engines implement it.

`decisiveRuleIds` in the API are the IDs of the rules whose outcome matches the final decision
(`deny` rules for denied, `escalate` rules for escalated, `approve` rules for approved), in rule order.

### R07 flags

R07 records which signals fired as flags on the decision trace:

| Flag | Condition |
|---|---|
| `HIGH_REFUND_FREQUENCY` | 3+ approved refunds for this customer in the last 90 days |
| `CLAIM_CONFLICT` | The model set `claimsConflict`, **or** the reason is `not_received` while the order is delivered (deterministic check) |
| `INJECTION_HEURISTIC` | The heuristic detector matched a pattern in any customer message in the conversation |
| `INJECTION_MODEL` | The model set `injectionSuspected` |
| `LOW_CONFIDENCE` | Model confidence below 0.6 or reason `unclear` after the clarification limit was reached |
| `AI_UNAVAILABLE` | The extraction call failed twice (timeout, invalid output, provider error) |

The pipeline may also add these flags, which do not affect the decision by themselves:

| Flag | Condition |
|---|---|
| `CLARIFICATION_EXHAUSTED` | Two unclear turns in a row; the pipeline stops asking and decides |
| `REPLY_GUARD_FALLBACK` | The composed reply failed the reply guard and a template was used instead |
| `COMPOSE_UNAVAILABLE` | The compose call failed twice and a template was used instead |

## Money and dates

- Money is stored as integer cents. The refund amount is `sum(unitPriceCents × quantity)` over the
  selected order items, read from the database. Text from the customer is never used for amounts.
- Dates are stored in UTC. "Days since delivery" is `floor((now − deliveredAt) / 24h)`.

## Documented assumptions

- **Merchant fault on final sale items escalates.** A damaged, defective or wrong final-sale item is
  a consumer protection grey area, so R04 escalates instead of denying.
- **Not received is never auto-approved.** It needs carrier investigation, so R10 escalates it. When
  the tracking says delivered, R07 also flags a conflict.
- **Historical refunds count.** Approved refunds imported from before the assistant existed count
  towards R05 and R07.
- **USD only.** No currency conversion and no payment execution. An approved request is a decision,
  not a payout.
