import type { SupportedBlock } from '../types';

/**
 * Inline error shown when imported JSON is neither a bare blocks array
 * nor a Slack message wrapper. Exported so callers (and tests) share the
 * exact copy.
 */
export const BLOCKS_INPUT_SHAPE_ERROR = 'Expected an array of blocks, or an object with a `blocks` array.';

/**
 * Normalize a parsed JSON value into a bare blocks array.
 *
 * The builder emits (and the JSON drawer seeds from) a bare array of
 * blocks. Slack's own Block Kit Builder, however, exports the full message
 * wrapper — `{ "blocks": [ ... ] }` — so a straight paste from there would
 * otherwise fail. Accept either shape: a bare array passes through, and a
 * `{ blocks: [...] }` object is unwrapped down to its `blocks` array. Other
 * top-level keys on the wrapper (`text`, `channel`, `attachments`, …) are
 * ignored.
 *
 * Returns `null` when the value is neither shape, so the caller can surface
 * its existing inline error without mutating state.
 *
 * @param parsed - the value returned from `JSON.parse`
 * @returns the blocks array, or `null` when the shape is unrecognized
 */
export function unwrapBlocksInput(parsed: unknown): SupportedBlock[] | null {
  if (Array.isArray(parsed)) {
    return parsed as SupportedBlock[];
  }
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { blocks?: unknown }).blocks)) {
    // Strip the Slack message wrapper down to the blocks array.
    return (parsed as { blocks: SupportedBlock[] }).blocks;
  }
  return null;
}
