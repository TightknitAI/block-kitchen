import type { Editor } from '@tiptap/react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { Popover, PopoverAnchor, PopoverContent } from '../../lib/ui/popover';
import { isSafeImageSrc } from '../../lib/url-safety';
import type { MentionUser } from '../../types';

/** What the open `@` picker shows, mirrored from the suggestion plugin. */
export interface MentionPickerState {
  items: MentionUser[];
  loading: boolean;
  clientRect: (() => DOMRect | null) | null;
  command: (user: MentionUser) => void;
}

/**
 * Handles a keydown the suggestion plugin forwards while the picker is open.
 * @returns true when the picker consumed the key
 */
export type MentionPickerKeyHandler = (event: KeyboardEvent) => boolean;

/**
 * Mirrors the suggestion plugin's props into picker state. The plugin empties
 * `items` while each new search runs, so the previous results stay up until
 * the next ones land instead of flashing "Searching…" on every keystroke.
 * @param props - the suggestion plugin's render props
 * @param prev - the picker state being replaced, if open
 * @returns the next picker state
 */
export function nextMentionPickerState(
  props: SuggestionProps<MentionUser, MentionUser>,
  prev: MentionPickerState | null
): MentionPickerState {
  return {
    items: props.loading && prev ? prev.items : props.items,
    loading: props.loading,
    clientRect: props.clientRect ?? null,
    command: props.command
  };
}

/**
 * The `@` picker's result list, anchored at the typed `@`. Focus stays in the
 * editor throughout: the suggestion plugin forwards Arrow/Enter/Tab through
 * `keyHandlerRef`, and Escape or a click elsewhere dismisses it.
 * @param props - picker props
 * @param props.editor - the editor the picker belongs to
 * @param props.state - what the picker shows
 * @param props.keyHandlerRef - receives the picker's key handler while it is open
 * @param props.onDismiss - closes the picker without inserting anything
 * @returns the rendered picker
 */
export function MentionPicker({
  editor,
  state,
  keyHandlerRef,
  onDismiss
}: {
  editor: Editor;
  state: MentionPickerState;
  keyHandlerRef: RefObject<MentionPickerKeyHandler>;
  onDismiss: () => void;
}) {
  const { items, loading, clientRect, command } = state;
  const [activeIndex, setActiveIndex] = useState(0);
  const [shownItems, setShownItems] = useState(items);
  if (shownItems !== items) {
    setShownItems(items);
    setActiveIndex(0);
  }
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    keyHandlerRef.current = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (items.length > 0) {
          const step = event.key === 'ArrowDown' ? 1 : -1;
          setActiveIndex((index) => (index + step + items.length) % items.length);
        }
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const user = items[activeIndex];
        // With nothing to pick, release the key so Enter still breaks the line.
        if (!user) {
          return false;
        }
        command(user);
        return true;
      }
      return false;
    };
    return () => {
      keyHandlerRef.current = () => false;
    };
  }, [keyHandlerRef, items, activeIndex, command]);

  // Follow the active row with the scroll position. jsdom has no
  // `scrollIntoView`, and it's a nicety either way.
  useEffect(() => {
    const row = listRef.current?.querySelectorAll('[role="option"]')[activeIndex];
    (row as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  // A fresh anchor per caret rect, so the popper repositions as it moves.
  const anchorRef = useMemo(
    () => ({
      current: {
        getBoundingClientRect: () => clientRect?.() ?? editor.view.dom.getBoundingClientRect()
      }
    }),
    [clientRect, editor]
  );

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) {
          onDismiss();
        }
      }}
    >
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="max-h-[min(15rem,var(--radix-popover-content-available-height))] w-64 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // Radix sees Escape first, in the document's capture phase. Stop it
        // there so it closes only the picker: the inline rich text editor
        // discards the whole edit on an Escape that reaches it.
        onEscapeKeyDown={(e) => e.stopPropagation()}
        // Clicks in the editor are the suggestion plugin's to judge: moving the
        // caret out of the `@query` closes the picker, moving within it doesn't.
        onInteractOutside={(e) => {
          if (e.target instanceof Node && editor.view.dom.contains(e.target)) {
            e.preventDefault();
          }
        }}
      >
        <div ref={listRef} role="listbox" aria-label="People to mention">
          {items.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {loading ? 'Searching…' : 'No people match that search.'}
            </p>
          ) : (
            items.map((user, index) => (
              // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the editor, which drives this list through the suggestion plugin's key handling.
              // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard path is the editor's, forwarded via keyHandlerRef.
              <div
                key={user.id}
                role="option"
                aria-selected={index === activeIndex}
                // Keep focus (and the caret) in the editor until the pick lands.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => command(user)}
                onMouseMove={() => setActiveIndex(index)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground',
                  index === activeIndex && 'bg-accent'
                )}
              >
                <MentionAvatar user={user} />
                <span className="truncate">{user.name}</span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * A picker row's avatar: the person's image, or their initial when they have
 * none, it isn't a safe image URL, or it fails to load.
 * @param props - avatar props
 * @param props.user - the person the row offers
 * @returns the rendered avatar
 */
function MentionAvatar({ user }: { user: MentionUser }) {
  const [failed, setFailed] = useState(false);
  const src = user.avatarUrl && isSafeImageSrc(user.avatarUrl) ? user.avatarUrl : null;
  if (src && !failed) {
    return <img src={src} alt="" className="h-5 w-5 shrink-0 rounded object-cover" onError={() => setFailed(true)} />;
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-medium text-muted-foreground"
    >
      {Array.from(user.name.trim())[0]?.toUpperCase() ?? '@'}
    </span>
  );
}
