import { useCallback, useMemo, useState } from 'react';

/**
 * Upper bound on retained undo steps. Editing sessions rarely need more,
 * and the cap keeps a long session's memory footprint flat: once `past`
 * grows past this, the oldest snapshot is dropped on the next commit.
 */
export const MAX_HISTORY = 100;

/** Internal past/present/future record plus the coalescing tag. */
type HistoryRecord<T> = {
  past: T[];
  present: T;
  future: T[];
  /**
   * Tag of the most recent commit, used to coalesce a run of same-tag
   * commits into one undo step. `null` after an initial state, an
   * untagged commit, an undo, a redo, or a reset — so the next commit
   * always starts a fresh step.
   */
  lastTag: string | null;
};

/** Public surface of {@link useHistoryState}. */
export type HistoryState<T> = {
  /** The current value. */
  present: T;
  /** Whether there is a past state to step back to. */
  canUndo: boolean;
  /** Whether there is an undone state to step forward to. */
  canRedo: boolean;
  /**
   * Record a new value. Accepts a value or an updater (like `setState`).
   * A commit that leaves the value referentially unchanged is ignored
   * (history and the coalescing tag are left untouched).
   *
   * Pass `options.tag` to coalesce: consecutive commits carrying the same
   * tag collapse into a single undo step (the present is replaced in place
   * rather than pushed), so per-keystroke text edits on one field don't
   * flood the undo stack. Any untagged commit, a different tag, or an
   * undo/redo breaks the run.
   */
  commit: (updater: T | ((prev: T) => T), options?: { tag?: string }) => void;
  /** Step back to the previous state (no-op when {@link canUndo} is false). */
  undo: () => void;
  /** Step forward to the next state (no-op when {@link canRedo} is false). */
  redo: () => void;
  /**
   * Replace the value and clear all history — a fresh baseline, as when a
   * new document is loaded. Unlike {@link commit}, the result is not
   * reachable by undo.
   */
  reset: (next: T) => void;
};

/**
 * Generic undo/redo state container built on the classic
 * past / present / future model.
 *
 * Kept independent of the block builder so the coalescing and history
 * mechanics can be reasoned about (and tested) on their own; the builder
 * layers domain meaning on top via commit tags.
 * @param initial - the initial value, or a lazy initializer
 * @returns the current value plus history controls
 */
export function useHistoryState<T>(initial: T | (() => T)): HistoryState<T> {
  const [record, setRecord] = useState<HistoryRecord<T>>(() => ({
    past: [],
    present: typeof initial === 'function' ? (initial as () => T)() : initial,
    future: [],
    lastTag: null
  }));

  const commit = useCallback<HistoryState<T>['commit']>((updater, options) => {
    const tag = options?.tag ?? null;
    setRecord((h) => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(h.present) : updater;
      if (Object.is(next, h.present)) {
        // No-op update (a mutator that resolved to its input): don't push a
        // dead history entry, and don't disturb the active coalescing run.
        return h;
      }
      if (tag !== null && h.lastTag === tag) {
        // Same tagged run (e.g. another keystroke on the same field): fold
        // into the current step. Any redo branch is still invalidated.
        return { ...h, present: next, future: [] };
      }
      const past = [...h.past, h.present];
      return {
        past: past.length > MAX_HISTORY ? past.slice(past.length - MAX_HISTORY) : past,
        present: next,
        future: [],
        lastTag: tag
      };
    });
  }, []);

  const undo = useCallback(() => {
    setRecord((h) => {
      if (h.past.length === 0) {
        return h;
      }
      const previous = h.past[h.past.length - 1];
      return { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future], lastTag: null };
    });
  }, []);

  const redo = useCallback(() => {
    setRecord((h) => {
      if (h.future.length === 0) {
        return h;
      }
      const [next, ...rest] = h.future;
      return { past: [...h.past, h.present], present: next, future: rest, lastTag: null };
    });
  }, []);

  const reset = useCallback((next: T) => {
    setRecord({ past: [], present: next, future: [], lastTag: null });
  }, []);

  return useMemo(
    () => ({
      present: record.present,
      canUndo: record.past.length > 0,
      canRedo: record.future.length > 0,
      commit,
      undo,
      redo,
      reset
    }),
    [record, commit, undo, redo, reset]
  );
}
