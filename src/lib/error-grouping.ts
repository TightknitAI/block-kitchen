import type { Surface } from '@tightknitai/slack-block-kit-validator';
import type { BuilderBlock, PreviewSurface } from '../types';

/**
 * Result of grouping a flat validator error list into builder buckets.
 */
export interface GroupedErrors {
  /** All errors keyed by builder block id. Buckets without errors are absent. */
  byBlockId: Map<string, string[]>;
  /** Errors that don't map to a specific block (root-level, cross-block, etc). */
  general: string[];
  /** Total count across both buckets. */
  total: number;
}

/**
 * Maps the builder's {@link PreviewSurface} (which uses `app_home`) to the
 * validator's {@link Surface} (which uses `home`).
 * @param surface - the builder's surface value
 * @returns the validator-compatible surface
 */
export function toValidatorSurface(surface: PreviewSurface): Surface {
  return surface === 'app_home' ? 'home' : surface;
}

/**
 * Leading path token in a validator message that scopes the error to a
 * single block, e.g. `blocks[2]`, `blocks[2].elements`, `blocks[0].type`.
 * `@tightknitai/slack-block-kit-validator` (>= 0.1.x) emits dot/bracket
 * paths like `blocks[1].elements: fewer than 1 items`; cross-block caveat
 * helpers use a bare space (`blocks[1].block_id must be unique — ...`).
 * The capture group is the zero-based block index.
 */
const BLOCK_PREFIX = /^blocks\[(\d+)\]/;

/**
 * Returns the block index a validator message is scoped to, or null when the
 * message isn't rooted at a specific `blocks[N]` entry (root errors, the
 * blocks-array-itself errors a view envelope can raise, etc).
 * @param raw - a single error string from `validateBlockKit`
 * @returns the zero-based block index, or null
 */
function extractBlockIndex(raw: string): number | null {
  const match = BLOCK_PREFIX.exec(raw);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * Strips the `blocks[N]` prefix from a block-scoped message so the text
 * shown next to a block doesn't redundantly repeat the block index, keeping
 * any sub-path as useful context.
 *
 * - `blocks[1].elements: fewer than 1 items` → `elements: fewer than 1 items`
 * - `blocks[0]: missing required property 'text'` → `missing required property 'text'`
 * - `blocks[1].block_id must be unique — …` → `block_id must be unique — …`
 *
 * @param raw - the original block-scoped error string
 * @returns the message without its leading `blocks[N]` prefix
 */
function toBlockMessage(raw: string): string {
  const rest = raw.replace(BLOCK_PREFIX, '');
  // Block-root errors read `blocks[N]: <message>` — drop the orphaned colon
  // so we're left with just the message.
  if (rest.startsWith(':')) {
    return rest.replace(/^:\s*/, '');
  }
  // Sub-path errors keep the path as context; drop only the joining dot
  // (`.elements` → `elements`), leaving bracket indices (`[0]`) intact.
  return rest.replace(/^\./, '');
}

/**
 * Lightly cleans a non-block-scoped message for display, dropping the
 * `(root)` sentinel the validator uses for top-level issues.
 * @param raw - the original general error string
 * @returns the cleaned message
 */
function toGeneralMessage(raw: string): string {
  return raw.startsWith('(root)') ? raw.replace(/^\(root\):?\s*/, '') : raw;
}

/**
 * Splits a flat array of validator error strings into per-block buckets
 * keyed by the matching {@link BuilderBlock.id}, plus a general bucket for
 * anything not tied to a single block.
 *
 * Pairs with `@tightknitai/slack-block-kit-validator` >= 0.1.x, which
 * collapses the AJV `oneOf` cascade (one structural mistake no longer yields
 * ~25 branch errors) and emits `blocks[N]...`-rooted paths. The exact path
 * shape is pinned by `error-grouping.test.ts`.
 * @param errors - flat error list from `validateBlockKit`
 * @param blocks - the builder blocks in the same order as the validated payload
 * @returns the grouped error buckets
 */
export function groupValidatorErrors(errors: readonly string[], blocks: readonly BuilderBlock[]): GroupedErrors {
  const byBlockId = new Map<string, string[]>();
  const general: string[] = [];

  for (const raw of errors) {
    const idx = extractBlockIndex(raw);
    if (idx === null || idx >= blocks.length) {
      general.push(toGeneralMessage(raw));
      continue;
    }

    const id = blocks[idx].id;
    const bucket = byBlockId.get(id) ?? [];
    bucket.push(toBlockMessage(raw));
    byBlockId.set(id, bucket);
  }

  return { byBlockId, general, total: errors.length };
}
