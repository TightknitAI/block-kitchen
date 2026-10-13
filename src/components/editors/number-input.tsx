import { useEffect, useState } from 'react';
import { Input } from '../../lib/ui/input';

/**
 * Numeric input that keeps a local string draft so partial values like a
 * lone "-" type cleanly. Commits a parsed number on every valid keystroke
 * and normalizes (empty / invalid → 0) on blur. Resyncs when the model
 * value changes from outside (e.g. a chart-type switch or row reindex).
 * @param props - input props
 * @param props.id - optional id, for a label's `htmlFor`
 * @param props.value - the current number
 * @param props.onCommit - called with each parsed number
 * @param props.ariaLabel - accessible name when there is no visible label
 * @param props.className - extra classes for the input
 * @returns the rendered number input
 */
export function NumberInput({
  id,
  value,
  onCommit,
  ariaLabel,
  className
}: {
  id?: string;
  value: number;
  onCommit: (next: number) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={draft}
      className={className}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        // Skip intermediate states that don't parse to a number yet.
        if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
          return;
        }
        const next = Number(raw);
        if (!Number.isNaN(next)) {
          onCommit(next);
        }
      }}
      onBlur={() => {
        const next = Number(draft);
        const safe = draft.trim() === '' || Number.isNaN(next) ? 0 : next;
        onCommit(safe);
        setDraft(String(safe));
      }}
    />
  );
}
