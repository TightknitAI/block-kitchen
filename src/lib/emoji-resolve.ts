import type { CustomEmoji } from '../types';
import { type EmojiIndex, getEmojiIndex, unifiedToUnicode } from './emoji-data';
import type { EmojiImportResolver } from './rich-text-tiptap';

/**
 * Builds an {@link EmojiImportResolver} that resolves a Slack emoji element's
 * render-only attributes from the workspace custom emoji and the standard
 * `emoji-datasource` index:
 *
 * - A custom emoji with a `url` → `src` is the workspace image.
 * - A custom alias (no `url`) → resolve the glyph from the alias target.
 * - A standard emoji → `unicode` from the dataset (toned when `skin_tone` is
 *   set), so the editor renders the glyph even before the payload carries one.
 *
 * Best-effort and synchronous: when the dataset isn't loaded yet it falls back
 * to whatever `unicode` the payload already specifies.
 *
 * @param customByName - workspace custom emoji keyed by codename
 * @param index - the emoji index (defaults to the cached one)
 * @returns an import resolver for `richTextToProseMirror`
 */
export function makeEmojiImportResolver(
  customByName: Map<string, CustomEmoji>,
  index: EmojiIndex | null = getEmojiIndex()
): EmojiImportResolver {
  return (el) => {
    const name = el.name ?? '';
    const skinTone = el.skin_tone ?? null;
    const custom = customByName.get(name);
    if (custom?.url) {
      return { name, src: custom.url, unicode: null, skinTone };
    }
    const lookupName = custom?.alias ?? name;
    const datum = index?.byName.get(lookupName);
    let unicode = el.unicode ?? null;
    if (!unicode && datum) {
      const toned = skinTone ? datum.skinUnified[skinTone] : undefined;
      unicode = unifiedToUnicode(toned ?? datum.unified);
    }
    return { name, src: null, unicode, skinTone };
  };
}
