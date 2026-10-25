import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import { BlockEditor } from '../src/components/editors/block-editor';
import { returnFocusUnlessMoved } from '../src/lib/ui/popover';
import type { SupportedBlock } from '../src/types';

const IMAGE: SupportedBlock = { type: 'image', image_url: 'https://example.com/cover.png', alt_text: 'Cover' };
const HEADER: SupportedBlock = { type: 'header', text: { type: 'plain_text', text: 'Title' } };

/**
 * The row's own popover trigger: its first "Edit block" control.
 * @param index - the block's position in the draft
 * @returns the trigger
 */
function rowTrigger(index: number): HTMLElement {
  const row = document.querySelector(`[data-bk-block-index="${index}"]`) as HTMLElement;
  return within(row).getAllByLabelText('Edit block')[0];
}

it('offers a close button beside the title only when the editor can be dismissed', () => {
  const onDone = vi.fn();
  const { rerender } = render(<BlockEditor block={IMAGE} onChange={vi.fn()} onDone={onDone} />);

  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
  expect(onDone).toHaveBeenCalledTimes(1);

  rerender(<BlockEditor block={IMAGE} onChange={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Close editor' })).toBeNull();
});

it("closes a block's editor popover from the close button", () => {
  render(<BlockKitchen initialBlocks={[IMAGE]} />);

  fireEvent.click(rowTrigger(0));
  expect(screen.getByRole('heading', { name: 'Edit Image' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Close editor' }));
  expect(screen.queryByRole('heading', { name: 'Edit Image' })).toBeNull();
});

it("opens the clicked block's editor while another block's editor is open", async () => {
  render(<BlockKitchen initialBlocks={[HEADER, IMAGE]} />);
  fireEvent.click(rowTrigger(1));
  expect(screen.getByRole('heading', { name: 'Edit Image' })).toBeTruthy();
  // Radix attaches its outside-click listener a tick after the popover opens.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  // The open editor closes itself on the outside pointerdown, after the click
  // has already opened the other block's editor.
  fireEvent.pointerDown(rowTrigger(0), { button: 0, pointerType: 'mouse' });
  fireEvent.click(rowTrigger(0));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  expect(screen.getByRole('heading', { name: 'Edit Header' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Edit Image' })).toBeNull();
});

/**
 * A close auto-focus event dispatched on a closing popover's content.
 * @param content - the closing content
 * @returns whether the trigger may take focus back
 */
function closeAutoFocus(content: HTMLElement): boolean {
  const event = new Event('focusScope.autoFocusOnUnmount', { cancelable: true });
  content.dispatchEvent(event);
  return !event.defaultPrevented;
}

it('returns focus to the trigger only when focus has not moved outside the closing popover', () => {
  const content = document.createElement('div');
  const inside = document.createElement('button');
  const elsewhere = document.createElement('button');
  content.append(inside);
  document.body.append(content, elsewhere);
  content.addEventListener('focusScope.autoFocusOnUnmount', returnFocusUnlessMoved);

  inside.focus();
  expect(closeAutoFocus(content)).toBe(true);

  (document.activeElement as HTMLElement).blur();
  expect(closeAutoFocus(content)).toBe(true);

  // Another block's editor has taken focus.
  elsewhere.focus();
  expect(closeAutoFocus(content)).toBe(false);

  content.remove();
  elsewhere.remove();
});
