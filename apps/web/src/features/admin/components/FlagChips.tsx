import type { Flag } from '@worknoon/contracts';
import { flagMap } from '@/shared/lib/statusMap';
import { Badge } from '@/shared/ui/badge';

export function FlagChips({ flags, emptyLabel = 'None' }: { flags: Flag[]; emptyLabel?: string }) {
  if (flags.length === 0)
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Flags">
      {flags.map((flag) => (
        <li key={flag}>
          <Badge tone={flagMap[flag].tone} title={flagMap[flag].description}>
            {flagMap[flag].label}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export function RuleChips({
  ruleIds,
  emptyLabel = 'None',
}: {
  ruleIds: string[];
  emptyLabel?: string;
}) {
  if (ruleIds.length === 0)
    return <span className="text-xs text-muted-foreground">{emptyLabel}</span>;
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Decisive rules">
      {ruleIds.map((ruleId) => (
        <li key={ruleId}>
          <Badge shape="chip" tone="outline">
            {ruleId}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
