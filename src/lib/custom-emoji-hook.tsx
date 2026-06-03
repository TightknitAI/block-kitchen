import type { ReactNode } from 'react';
import type { CustomEmoji } from '../types';

/**
 * The emoji object `slack-blocks-to-jsx` hands to the `emoji` hook. Mirrors
 * the upstream `Emoji` type without importing it, so we don't leak the
 * library's internal types into our surface. `unicode` / `skin_tone` are only
 * present for rich-text emoji elements; mrkdwn emoji arrive with `name` alone.
 */
interface HookEmoji {
  name: string;
  unicode?: string;
  skin_tone?: 1 | 2 | 3 | 4 | 5 | 6;
}

/** The shape of the `emoji` hook expected by `slack-blocks-to-jsx`. */
export type EmojiHook = (data: HookEmoji, parse: (data: HookEmoji) => string) => ReactNode;

/**
 * Builds the `emoji` preview hook from a `byName` lookup of workspace custom
 * emoji. Resolution mirrors the companion site's `InlineEmoji` logic:
 *
 * - A matching entry with a `url` renders the workspace image.
 * - A matching alias entry (no `url`) defers to the library's default parser
 *   using the alias target's name, preserving any `unicode` / `skin_tone`.
 * - Anything else (standard emoji, or an unknown name) falls through to the
 *   library's default parser unchanged.
 *
 * The hook never alters the underlying payload — `url` is render-only.
 *
 * @param byName - lookup of custom emoji keyed by codename
 * @returns an `emoji` hook for `slack-blocks-to-jsx`
 */
export function makeEmojiHook(byName: Map<string, CustomEmoji>): EmojiHook {
  return (data, parse) => {
    const entry = byName.get(data.name);
    if (entry) {
      if (entry.url) {
        return (
          <img
            src={entry.url}
            alt={`:${data.name}:`}
            title={`:${data.name}:`}
            className="bk-custom-emoji"
            style={{
              display: 'inline-block',
              width: '1.25em',
              height: '1.25em',
              verticalAlign: '-0.25em',
              objectFit: 'contain'
            }}
          />
        );
      }
      if (entry.alias) {
        return parse({ name: entry.alias, unicode: data.unicode, skin_tone: data.skin_tone });
      }
    }
    return parse(data);
  };
}
