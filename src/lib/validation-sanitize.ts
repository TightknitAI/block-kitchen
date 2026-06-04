import type { SupportedBlock } from '../types';

/**
 * A Slack codename guaranteed to be in the validator's known-emoji set, used
 * to neutralize custom / unknown emoji names in the validation copy only.
 */
export const VALIDATION_EMOJI_PLACEHOLDER = 'white_check_mark';

/**
 * Recursively clone `value`, rewriting the `name` of every `rich_text` emoji
 * element (`{ type: 'emoji', name }`) to {@link VALIDATION_EMOJI_PLACEHOLDER}.
 * Copy-on-write: returns the original reference for any subtree that contains
 * no emoji, so emoji-free drafts allocate nothing. Never mutates the input.
 */
function rewriteEmojiNames<T>(value: T): T {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const rewritten = rewriteEmojiNames(item);
      if (rewritten !== item) {
        changed = true;
      }
      return rewritten;
    });
    return (changed ? next : value) as T;
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      const rewritten = rewriteEmojiNames(source[key]);
      next[key] = rewritten;
      if (rewritten !== source[key]) {
        changed = true;
      }
    }
    if (next.type === 'emoji' && typeof next.name === 'string' && next.name !== VALIDATION_EMOJI_PLACEHOLDER) {
      next.name = VALIDATION_EMOJI_PLACEHOLDER;
      changed = true;
    }
    return (changed ? next : value) as T;
  }
  return value;
}

/**
 * Validation-only sanitizer: returns a deep copy of `blocks` with every
 * `rich_text` emoji `name` rewritten to a known-valid placeholder. Slack itself
 * never rejects unknown emoji names, so workspace-custom emoji should not count
 * toward the validator's error total (which gates the Send button). The real
 * payload (preview / JSON / Send) keeps the true name — only the copy handed to
 * the validator is rewritten.
 *
 * Walks the whole block so emoji nested inside `task_card` / `plan` / table
 * `rich_text` cells are covered too.
 *
 * @param blocks - the Slack-shaped blocks about to be validated
 * @returns a deep copy with emoji names neutralized
 */
export function stripCustomEmojiForValidation(blocks: SupportedBlock[]): SupportedBlock[] {
  return blocks.map((block) => rewriteEmojiNames(block));
}
