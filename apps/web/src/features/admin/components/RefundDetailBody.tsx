import type { AuditEvent, RefundRequestDetail } from '@worknoon/contracts';
import { Bot, CheckCircle2, Info, ShieldAlert, User, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatDateTime } from '@/shared/lib/formatDate';
import { formatMoney } from '@/shared/lib/formatMoney';
import { decidedByMap, humanize, reasonCategoryMap, ruleOutcomeMap } from '@/shared/lib/statusMap';
import { Badge } from '@/shared/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { FlagChips } from './FlagChips';
import { ReviewPanel } from './ReviewPanel';

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="grid gap-3 border-b px-5 py-5 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

function YesNo({ value, danger = false }: { value: boolean; danger?: boolean }) {
  return value ? (
    <Badge tone={danger ? 'danger' : 'warning'}>Yes</Badge>
  ) : (
    <Badge tone="neutral">No</Badge>
  );
}

export function RefundDetailBody({ detail }: { detail: RefundRequestDetail }) {
  const { trace } = detail;
  const decisive = new Set(detail.decisiveRuleIds);
  const extraction = trace.extraction;
  const confidencePct = extraction ? Math.round(extraction.confidence * 100) : 0;

  return (
    <div>
      <Section title="Summary">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Amount">
            <span className="tabular-nums">{formatMoney(detail.amountCents)}</span>
          </Fact>
          <Fact label="Decided by">{decidedByMap[detail.decidedBy].label}</Fact>
          <Fact label="Reason">
            {detail.reasonCategory ? reasonCategoryMap[detail.reasonCategory] : 'Unknown'}
          </Fact>
          <Fact label="Created">{formatDateTime(detail.createdAt)}</Fact>
          <Fact label="Days since delivery">
            {trace.facts.daysSinceDelivery ?? 'Not delivered'}
          </Fact>
          <Fact label="Recent approved refunds">{trace.facts.recentApprovedRefunds}</Fact>
          <Fact label="Order status">{humanize(trace.facts.orderStatus)}</Fact>
          <Fact label="Clarification turns">{trace.clarificationTurns}</Fact>
          <Fact label="Policy version">
            <span className="font-mono">{trace.policyVersion}</span>
          </Fact>
        </dl>
      </Section>

      {detail.status === 'escalated' && !detail.review && (
        <div className="border-b px-5 py-5">
          <ReviewPanel refundRequestId={detail.id} />
        </div>
      )}

      {detail.review && (
        <Section title="Review">
          <div
            className={cn(
              'flex items-start gap-3 rounded-lg border p-3',
              detail.review.decision === 'approve' ? 'bg-success-soft/60' : 'bg-danger-soft/60',
            )}
          >
            {detail.review.decision === 'approve' ? (
              <CheckCircle2 className="mt-0.5 size-4 text-success-strong" aria-hidden="true" />
            ) : (
              <XCircle className="mt-0.5 size-4 text-danger-strong" aria-hidden="true" />
            )}
            <div className="grid gap-1 text-sm">
              <p className="font-medium">
                {detail.review.decision === 'approve' ? 'Approved' : 'Denied'} by{' '}
                {detail.review.reviewer}
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · {formatDateTime(detail.review.reviewedAt)}
                </span>
              </p>
              <p className="text-muted-foreground">&ldquo;{detail.review.note}&rdquo;</p>
            </div>
          </div>
        </Section>
      )}

      <Section title="Items">
        <ul className="divide-y rounded-lg border bg-card">
          {detail.items.map((item) => (
            <li
              key={item.orderItemId}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {item.name}
                  {item.finalSale && <Badge className="text-[10px] uppercase">Final sale</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{item.sku}</span> · Qty {item.quantity}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatMoney(item.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Flags">
        <FlagChips flags={detail.flags} emptyLabel="No flags raised" />
      </Section>

      <Section
        title="Rule trace"
        aside={
          <span className="text-[11px] text-muted-foreground">
            Evaluated {formatDateTime(trace.evaluatedAt)}
          </span>
        }
      >
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-16">Rule</TableHead>
                <TableHead className="w-24">Outcome</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trace.rules.map((rule) => {
                const meta = ruleOutcomeMap[rule.outcome];
                const isDecisive = decisive.has(rule.ruleId);
                return (
                  <TableRow
                    key={rule.ruleId}
                    className={cn(isDecisive && 'bg-primary-soft/50 hover:bg-primary-soft/60')}
                  >
                    <TableCell className="py-2 font-mono text-xs font-semibold">
                      {rule.ruleId}
                      {isDecisive && <span className="sr-only"> (decisive)</span>}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground">
                      {rule.reason}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Highlighted rows are decisive for the outcome.
        </p>
      </Section>

      <Section title="AI extraction">
        {extraction ? (
          <div className="grid gap-3">
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Fact label="Reason">{reasonCategoryMap[extraction.reasonCategory]}</Fact>
              <Fact label="Claims conflict">
                <YesNo value={extraction.claimsConflict} />
              </Fact>
              <Fact label="Injection suspected">
                <YesNo value={extraction.injectionSuspected} danger />
              </Fact>
              <Fact label="Items mentioned">
                {extraction.itemsMentioned.length > 0
                  ? extraction.itemsMentioned.join(', ')
                  : 'None'}
              </Fact>
            </dl>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Confidence</span>
                <span className="font-medium tabular-nums">{confidencePct}%</span>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full rounded-full',
                    extraction.confidence >= 0.8
                      ? 'bg-success'
                      : extraction.confidence >= 0.6
                        ? 'bg-warning'
                        : 'bg-danger',
                  )}
                  style={{ width: `${confidencePct}%` }}
                />
              </div>
            </div>
            <blockquote className="rounded-lg border-l-2 border-primary bg-subtle px-3 py-2 text-sm">
              {extraction.summary}
            </blockquote>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="size-4 text-danger" aria-hidden="true" />
            No extraction: the analyzer was unavailable, so the request failed safe to review.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Heuristic matches:</span>
          {trace.heuristicMatches.length > 0 ? (
            trace.heuristicMatches.map((match) => (
              <Badge key={match} tone="danger" shape="chip">
                {match}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </div>
      </Section>

      <Section title="AI calls">
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Fact label="Provider">{trace.ai.provider}</Fact>
          <Fact label="Model">
            <span className="font-mono text-xs">{trace.ai.model}</span>
          </Fact>
          <Fact label="Extract prompt">
            <span className="font-mono text-xs">{trace.ai.promptVersions.extract}</span>
          </Fact>
          <Fact label="Compose prompt">
            <span className="font-mono text-xs">{trace.ai.promptVersions.compose}</span>
          </Fact>
        </dl>
        {trace.ai.calls.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Step</TableHead>
                  <TableHead>Attempt</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Tokens in/out</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trace.ai.calls.map((call, index) => (
                  <TableRow key={`${call.step}-${call.attempt}-${index}`}>
                    <TableCell className="py-2 text-xs font-medium">
                      {humanize(call.step)}
                    </TableCell>
                    <TableCell className="py-2 text-xs tabular-nums">{call.attempt}</TableCell>
                    <TableCell className="py-2">
                      <Badge tone={call.ok ? 'success' : 'danger'}>
                        {call.ok ? 'OK' : 'Failed'}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs tabular-nums">
                      {call.latencyMs} ms
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs tabular-nums">
                      {call.inputTokens} / {call.outputTokens}
                    </TableCell>
                    <TableCell className="py-2 font-mono text-xs">{call.error ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No AI calls were recorded.</p>
        )}
      </Section>

      <Section title="Reply guard">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={trace.replyGuard.passed ? 'success' : 'warning'} dot>
            {trace.replyGuard.passed ? 'Passed' : 'Violations found'}
          </Badge>
          <Badge tone={trace.replyGuard.usedTemplate ? 'info' : 'neutral'}>
            {trace.replyGuard.usedTemplate ? 'Template reply used' : 'Composed reply used'}
          </Badge>
        </div>
        {trace.replyGuard.violations.length > 0 && (
          <ul className="flex flex-wrap gap-1" aria-label="Reply guard violations">
            {trace.replyGuard.violations.map((violation) => (
              <li key={violation}>
                <Badge tone="warning" shape="chip">
                  {violation}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Conversation">
        <ol className="grid gap-2.5">
          {detail.conversation.messages.map((message) => (
            <li key={message.id} className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                  message.role === 'customer' && 'bg-muted text-muted-foreground',
                  message.role === 'assistant' &&
                    'bg-primary-soft text-primary dark:text-foreground',
                  message.role === 'system' && 'bg-info-soft text-info-strong',
                )}
                aria-hidden="true"
              >
                {message.role === 'customer' ? (
                  <User className="size-3.5" />
                ) : message.role === 'assistant' ? (
                  <Bot className="size-3.5" />
                ) : (
                  <Info className="size-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{humanize(message.role)}</span> ·{' '}
                  {formatDateTime(message.createdAt)}
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Audit timeline">
        <ol className="relative grid gap-4 border-l pl-5">
          {detail.auditEvents.map((event) => (
            <AuditItem key={event.id} event={event} />
          ))}
        </ol>
      </Section>
    </div>
  );
}

function AuditItem({ event }: { event: AuditEvent }) {
  const entries = Object.entries(event.data).filter(
    ([, value]) => value !== null && value !== undefined,
  );
  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary"
      />
      <p className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-mono text-xs font-semibold">{event.type}</span>
        <span className="text-xs text-muted-foreground">
          by {event.actor} · {formatDateTime(event.createdAt)}
        </span>
      </p>
      {entries.length > 0 && (
        <dl className="mt-1 grid gap-0.5 text-xs text-muted-foreground">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt className="shrink-0">{key}:</dt>
              <dd className="min-w-0 font-mono break-all text-foreground/80">
                {typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean'
                  ? String(value)
                  : JSON.stringify(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}
