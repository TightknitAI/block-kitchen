import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { CustomEmoji } from '../types';

/**
 * The value exposed to the builder tree: the raw `customEmojis` list plus a
 * `byName` lookup keyed on each entry's codename. Built once at the
 * {@link BlockKitchen} root so editors (emoji picker) and the preview can
 * resolve `:custom:` directives without prop-drilling through
 * `Surface → block-row → block-editor → *-editor`.
 */
export interface CustomEmojiContextValue {
  /** The custom emoji passed to {@link BlockKitchenProps.customEmojis}. */
  customEmojis: CustomEmoji[];
  /** Lookup of each custom emoji by its codename (`name`). */
  byName: Map<string, CustomEmoji>;
}

const EMPTY: CustomEmojiContextValue = {
  customEmojis: [],
  byName: new Map()
};

const CustomEmojiContext = createContext<CustomEmojiContextValue>(EMPTY);

/**
 * Provides the workspace custom emoji to the builder tree. Memoizes the
 * `byName` lookup so consumers get a stable reference while `customEmojis`
 * is unchanged. When `customEmojis` is omitted the context resolves to an
 * empty, shared value so descendants behave exactly as they did before the
 * prop existed.
 *
 * @param props.customEmojis - the workspace custom emoji (may be undefined)
 * @param props.children - the subtree that can read the context
 */
export function CustomEmojiProvider({ customEmojis, children }: { customEmojis?: CustomEmoji[]; children: ReactNode }) {
  const value = useMemo<CustomEmojiContextValue>(() => {
    if (!customEmojis || customEmojis.length === 0) {
      return EMPTY;
    }
    const byName = new Map<string, CustomEmoji>();
    for (const emoji of customEmojis) {
      byName.set(emoji.name, emoji);
    }
    return { customEmojis, byName };
  }, [customEmojis]);

  return <CustomEmojiContext.Provider value={value}>{children}</CustomEmojiContext.Provider>;
}

/**
 * Reads the custom emoji context. Returns the empty value when called outside
 * a {@link CustomEmojiProvider}, so it is always safe to call.
 */
export function useCustomEmojis(): CustomEmojiContextValue {
  return useContext(CustomEmojiContext);
}
