import { toast } from 'sonner';
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/toggle-group';
import { BACKENDS, isBackend, useBackend } from '../BackendContext';

export function BackendSwitcher() {
  const { backend, setBackend } = useBackend();

  return (
    <div className="flex items-center gap-2">
      <span id="backend-switcher-label" className="hidden text-xs text-muted-foreground lg:inline">
        Backend
      </span>
      <SegmentedControl
        type="single"
        value={backend}
        aria-labelledby="backend-switcher-label"
        aria-label="Backend"
        onValueChange={(value) => {
          // Radix emits '' when the active item is pressed again; ignore that.
          if (!isBackend(value) || value === backend) return;
          setBackend(value);
          toast.info(`Switched to the ${BACKENDS[value].label} backend`, {
            description: 'The conversation was reset and data reloaded.',
          });
        }}
      >
        {(Object.keys(BACKENDS) as (keyof typeof BACKENDS)[]).map((key) => (
          <SegmentedControlItem key={key} value={key} aria-label={`${BACKENDS[key].label} backend`}>
            {BACKENDS[key].label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );
}
