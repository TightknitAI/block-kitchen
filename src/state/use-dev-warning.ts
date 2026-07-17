import { useEffect, useRef } from 'react';

/**
 * Warns once (per component instance) when `condition` holds on any render
 * — not just the first. Mis-wired prop combinations introduced after mount
 * are caught, unlike a mount-only check, while the once-guard keeps the
 * console quiet across re-renders.
 *
 * Dev-ergonomics caveat: a host that wires props asynchronously (e.g. a
 * config that arrives one render after mount) can trip a warning during the
 * transient state; warnings are advisory, not behavior.
 *
 * @param condition - when true, the warning fires (once)
 * @param message - the console.warn payload
 */
export function useDevWarning(condition: boolean, message: string): void {
  const warnedRef = useRef(false);
  useEffect(() => {
    if (condition && !warnedRef.current) {
      warnedRef.current = true;
      console.warn(message);
    }
  }, [condition, message]);
}
