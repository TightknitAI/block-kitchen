import type { RefObject } from 'react';
import { composeTextEmoji } from '../../lib/emoji-data';
import { EmojiPickerButton } from './emoji-picker-button';

/**
 * "Insert emoji" control for plain_text / mrkdwn fields. Opens the emoji picker
 * and inserts the Slack shortcode form (`:name:` or `:name::skin-tone-N:`) at
 * the target field's caret, preserving the rest of the text and restoring the
 * caret after the inserted shortcode. Slack renders these shortcodes for both
 * standard and workspace-custom emoji.
 *
 * @param props.targetRef - ref to the input or textarea receiving the emoji
 * @param props.value - the field's current text (source of truth)
 * @param props.onChange - called with the next text after insertion
 * @param props.className - extra classes for the trigger button
 * @param props.align - popover alignment (default "end")
 */
export function EmojiTextInsertButton({
  targetRef,
  value,
  onChange,
  className,
  align = 'end'
}: {
  targetRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <EmojiPickerButton
      align={align}
      label="Insert emoji"
      className={className}
      onSelect={(sel) => {
        const el = targetRef.current;
        const insert = composeTextEmoji(sel.name, sel.skinTone ?? undefined);
        // Fall back to appending when the caret position is unknown (e.g. the
        // field was never focused). Reading selection on a blurred element is
        // well-supported and yields the last caret position.
        const start = el?.selectionStart ?? value.length;
        const end = el?.selectionEnd ?? value.length;
        const next = value.slice(0, start) + insert + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          if (el) {
            const caret = start + insert.length;
            el.focus();
            el.setSelectionRange(caret, caret);
          }
        });
      }}
    />
  );
}
