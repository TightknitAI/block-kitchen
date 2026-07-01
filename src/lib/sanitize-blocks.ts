import type { SupportedBlock } from '../types';
import { sanitizeHref, sanitizeImageSrc } from './url-safety';

/**
 * Recursively walks an unknown value and rewrites string values at the
 * specified keys via the matching sanitizer. Used to strip dangerous
 * URI schemes (e.g. `javascript:`) from `url`, `image_url`, and
 * rich-text link `url` fields before a Block Kit payload reaches a
 * renderer or is handed back to the consumer.
 *
 * Allocates a new object whenever a child is rewritten; otherwise
 * returns the input unchanged so unaffected payloads are reference-stable.
 *
 * Defensive against prototype-polluted shapes: copies are made via
 * `Object.assign({}, ...)` over own enumerable keys returned by
 * `Object.keys`, which skips inherited properties.
 */
const HREF_KEYS = new Set(['url']);
const IMAGE_KEYS = new Set(['image_url']);

/**
 * Read-only metadata Slack attaches when a message is *retrieved* via the
 * API, but rejects on *send*, keyed by the `type` of the object it appears
 * on. Blocks loaded from an existing message carry these; drop them only
 * from the matching object type — some are common field names (`fallback`)
 * that are valid elsewhere — so a round-tripped payload stays send-valid
 * without over-scrubbing. Add an entry to extend this to other block types.
 *
 * A `Map` (not a plain object) so lookups by an attacker-controlled `type`
 * cannot reach inherited properties like `toString`.
 */
const RETRIEVAL_ONLY_KEYS = new Map<string, Set<string>>([
  // Covers both the image block and the image element — both `type: 'image'`.
  ['image', new Set(['image_width', 'image_height', 'image_bytes', 'fallback', 'is_animated'])]
]);

/**
 * Recursively sanitize all known URL-bearing string fields inside a
 * Slack Block Kit payload fragment. Returns a value with the same
 * structural shape, where any field whose name matches an href or
 * image-src key has been replaced by the safe variant (`''` if the
 * original scheme was unsafe).
 * @param value - any payload fragment (object, array, primitive)
 * @returns the sanitized payload fragment
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const next = sanitizeValue(value[i]);
      if (next !== value[i]) {
        changed = true;
      }
      out[i] = next;
    }
    return changed ? out : value;
  }
  const src = value as Record<string, unknown>;
  const dropKeys = typeof src.type === 'string' ? RETRIEVAL_ONLY_KEYS.get(src.type) : undefined;
  let copy: Record<string, unknown> | null = null;
  for (const key of Object.keys(src)) {
    if (dropKeys?.has(key)) {
      copy ??= { ...src };
      delete copy[key];
      continue;
    }
    const original = src[key];
    let next: unknown = original;
    if (typeof original === 'string') {
      if (HREF_KEYS.has(key)) {
        next = sanitizeHref(original);
      } else if (IMAGE_KEYS.has(key)) {
        next = sanitizeImageSrc(original);
      }
    } else if (typeof original === 'object' && original !== null) {
      next = sanitizeValue(original);
    }
    if (next !== original) {
      if (!copy) {
        copy = { ...src };
      }
      copy[key] = next;
    }
  }
  return copy ?? src;
}

/**
 * Sanitize a single Block Kit block, scrubbing dangerous URI schemes
 * from `url` and `image_url` fields anywhere in the payload tree.
 * @param block - the block payload to sanitize
 * @returns the sanitized block (same reference if nothing changed)
 */
export function sanitizeBlock<T extends SupportedBlock>(block: T): T {
  return sanitizeValue(block) as T;
}

/**
 * Sanitize an array of Block Kit blocks. See {@link sanitizeBlock}.
 * @param blocks - the block payloads to sanitize
 * @returns the sanitized blocks
 */
export function sanitizeBlocks(blocks: SupportedBlock[]): SupportedBlock[] {
  let changed = false;
  const out = new Array<SupportedBlock>(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    const next = sanitizeBlock(blocks[i]);
    if (next !== blocks[i]) {
      changed = true;
    }
    out[i] = next;
  }
  return changed ? out : blocks;
}
