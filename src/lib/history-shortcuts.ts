import { useSyncExternalStore } from 'react';

/** The history step a key press asks for. */
export type HistoryShortcut = 'undo' | 'redo';

/** The parts of a key press, React's or the DOM's, that the shortcut handler reads. */
export type ShortcutKeyPress = Pick<
  KeyboardEvent,
  'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'defaultPrevented' | 'target' | 'preventDefault'
>;

/**
 * Reads an undo / redo shortcut off a key press: Cmd or Ctrl + Z undoes, and
 * Cmd or Ctrl + Shift + Z, or Ctrl + Y, redoes. Either modifier works on every
 * platform, so a Windows keyboard on a Mac (or the reverse) still undoes.
 * @param event - the key press
 * @returns the step it asks for, or `null` for any other key
 */
export function historyShortcutOf(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>
): HistoryShortcut | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === 'z') {
    return event.shiftKey ? 'redo' : 'undo';
  }
  return key === 'y' ? 'redo' : null;
}

/**
 * Whether a key press lands where the browser's own text undo applies: a text
 * field, a select, or editable content such as the inline rich-text editor.
 * @param target - the key press's target
 * @returns true when the builder should leave the shortcut to the browser
 */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    // jsdom has no `isContentEditable`, so check the attribute too.
    target.closest('[contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]') !== null ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  );
}

/**
 * Whether the viewer is on an Apple platform.
 * @returns true on macOS and iOS
 */
function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  const { userAgentData } = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac|iphone|ipad|ipod/i.test(userAgentData?.platform ?? navigator.platform ?? '');
}

const subscribeToNothing = () => () => {};

/**
 * Whether to show the shortcuts with Apple's ⌘ and ⇧ symbols. Server renders
 * (and the hydration pass) say `false`, so markup matches, then the client
 * corrects it.
 * @returns true on macOS and iOS
 */
export function useIsApplePlatform(): boolean {
  return useSyncExternalStore(subscribeToNothing, isApplePlatform, () => false);
}
