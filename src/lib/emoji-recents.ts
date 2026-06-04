/**
 * Tiny localStorage-backed store of recently picked emoji codenames. Used by
 * the emoji picker's "Frequently used" row. SSR/storage-restricted
 * environments degrade to an in-memory no-op (reads return `[]`).
 */

const STORAGE_KEY = 'bk:emoji-recents';
const SKIN_TONE_KEY = 'bk:emoji-skin-tone';
const MAX_RECENTS = 24;

/**
 * Reads the persisted picker skin tone (Slack `skin_tone` 2–6), or `null` for
 * the default (no tone). Degrades to `null` when storage is unavailable.
 * @returns the stored skin tone or null
 */
export function readEmojiSkinTone(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(SKIN_TONE_KEY);
    if (!raw) {
      return null;
    }
    const n = Number.parseInt(raw, 10);
    return n >= 2 && n <= 6 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Persists the picker skin tone. Pass `null` to clear (default tone).
 * @param skinTone - Slack `skin_tone` (2–6) or null
 */
export function writeEmojiSkinTone(skinTone: number | null): void {
  try {
    if (skinTone && skinTone >= 2 && skinTone <= 6) {
      globalThis.localStorage?.setItem(SKIN_TONE_KEY, String(skinTone));
    } else {
      globalThis.localStorage?.removeItem(SKIN_TONE_KEY);
    }
  } catch {
    // ignore write failures (private mode, quota, SSR)
  }
}

/**
 * Reads the recent emoji codenames, most-recent first. Returns an empty array
 * when storage is unavailable or the stored value is malformed.
 * @returns recent codenames
 */
export function readEmojiRecents(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is string => typeof n === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Records `name` as the most-recently used emoji, de-duplicating and capping
 * the list. Returns the updated list so callers can update state without a
 * re-read. No-ops gracefully when storage is unavailable.
 * @param name - the codename just picked
 * @returns the updated recents list, most-recent first
 */
export function pushEmojiRecent(name: string): string[] {
  const next = [name, ...readEmojiRecents().filter((n) => n !== name)].slice(0, MAX_RECENTS);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore write failures (private mode, quota, SSR)
  }
  return next;
}
