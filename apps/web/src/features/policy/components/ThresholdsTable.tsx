import type { PolicyConfig } from '@worknoon/contracts';
import { formatMoney } from '@/shared/lib/formatMoney';

function rows(config: PolicyConfig): { label: string; value: string; key: string }[] {
  return [
    {
      key: 'refundWindowDays',
      label: 'Refund window',
      value: `${config.refundWindowDays} days from delivery`,
    },
    {
      key: 'changeOfMindWindowDays',
      label: 'Change-of-mind window',
      value: `${config.changeOfMindWindowDays} days from delivery`,
    },
    {
      key: 'humanReviewThresholdCents',
      label: 'Human review above',
      value: formatMoney(config.humanReviewThresholdCents),
    },
    {
      key: 'suspiciousRefundCount',
      label: 'Suspicious refund count',
      value: `${config.suspiciousRefundCount}+ approved in ${config.suspiciousRefundLookbackDays} days`,
    },
    {
      key: 'minAiConfidence',
      label: 'Minimum AI confidence',
      value: `${Math.round(config.minAiConfidence * 100)}%`,
    },
    {
      key: 'maxClarificationTurns',
      label: 'Clarification turns',
      value: String(config.maxClarificationTurns),
    },
    {
      key: 'maxMessageLength',
      label: 'Max message length',
      value: `${config.maxMessageLength} characters`,
    },
    {
      key: 'maxItemsPerRequest',
      label: 'Max items per request',
      value: String(config.maxItemsPerRequest),
    },
    { key: 'currency', label: 'Currency', value: config.currency },
  ];
}

export function ThresholdsTable({ config }: { config: PolicyConfig }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Policy thresholds (version {config.version})</caption>
      <tbody className="divide-y">
        {rows(config).map((row) => (
          <tr key={row.key}>
            <th scope="row" className="py-2.5 pr-3 text-left font-normal text-muted-foreground">
              {row.label}
              <span className="block font-mono text-[10px] text-muted-foreground/70">
                {row.key}
              </span>
            </th>
            <td className="py-2.5 text-right font-medium tabular-nums">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
