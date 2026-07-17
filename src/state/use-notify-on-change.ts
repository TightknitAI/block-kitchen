import { useEffect, useRef } from 'react';

/**
 * Invokes `callback` with `value` whenever the serialized key of `value`
 * changes, deduping repeat renders that carry the same key. Shared by the
 * builder's host-notification channels (`onValidationChange`,
 * `onLoadedMessageChange`) so their semantics can't drift:
 *
 * - Nothing is recorded while `callback` is absent, so a subscriber
 *   attached on a later render still receives the current value.
 * - `callback` is an effect dependency; hosts that pass a fresh arrow each
 *   render just re-run into the key check (a no-op), while a genuinely new
 *   subscriber is caught up immediately.
 * - Dedupe is by serialized value, not object identity, so a re-computed
 *   value with identical content doesn't re-notify — and any field change
 *   does.
 *
 * @param value - the value to report
 * @param toKey - pure serializer; equal keys mean "already notified"
 * @param callback - the host callback, or undefined when not subscribed
 */
export function useNotifyOnChange<T>(
  value: T,
  toKey: (value: T) => string | null,
  callback: ((value: T) => void) | undefined
): void {
  const lastNotifiedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!callback) {
      return;
    }
    const key = toKey(value);
    if (lastNotifiedRef.current === key) {
      return;
    }
    lastNotifiedRef.current = key;
    callback(value);
  }, [value, toKey, callback]);
}
