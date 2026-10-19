import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { SupportedBlock } from '../src/types';

afterEach(() => vi.restoreAllMocks());

const section = (text: string): SupportedBlock => ({ type: 'section', text: { type: 'mrkdwn', text } });

/** The blocks array from the most recent onChange call. */
function latest(onChange: ReturnType<typeof vi.fn>): SupportedBlock[] {
  return onChange.mock.calls.at(-1)?.[0] as SupportedBlock[];
}

it('renders Undo/Redo buttons, disabled until there is history', () => {
  render(<BlockKitchen initialBlocks={[section('a')]} />);
  const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
  const redo = screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement;
  expect(undo.disabled).toBe(true);
  expect(redo.disabled).toBe(true);
});

it('undo/redo toolbar buttons step the draft back and forward', () => {
  const onChange = vi.fn();
  render(<BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />);

  // Delete the first block via its row toolbar.
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete block' })[0]);
  expect(latest(onChange)).toHaveLength(1);

  const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
  expect(undo.disabled).toBe(false);
  fireEvent.click(undo);
  expect(latest(onChange)).toHaveLength(2);

  const redo = screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement;
  expect(redo.disabled).toBe(false);
  fireEvent.click(redo);
  expect(latest(onChange)).toHaveLength(1);
});

it('supports Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts', () => {
  const onChange = vi.fn();
  const { container } = render(<BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />);
  const root = container.querySelector('.bk-root') as HTMLElement;

  fireEvent.click(screen.getAllByRole('button', { name: 'Delete block' })[0]);
  expect(latest(onChange)).toHaveLength(1);

  // Ctrl+Z undoes.
  fireEvent.keyDown(root, { key: 'z', ctrlKey: true });
  expect(latest(onChange)).toHaveLength(2);

  // Ctrl+Shift+Z redoes.
  fireEvent.keyDown(root, { key: 'z', ctrlKey: true, shiftKey: true });
  expect(latest(onChange)).toHaveLength(1);

  // Ctrl+Y also redoes (after another undo).
  fireEvent.keyDown(root, { key: 'z', ctrlKey: true });
  expect(latest(onChange)).toHaveLength(2);
  fireEvent.keyDown(root, { key: 'y', ctrlKey: true });
  expect(latest(onChange)).toHaveLength(1);
});

it('does not hijack undo while typing in a builder text field', () => {
  const onChange = vi.fn();
  render(<BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />);

  fireEvent.click(screen.getAllByRole('button', { name: 'Delete block' })[0]);
  expect(latest(onChange)).toHaveLength(1);
  const callsBefore = onChange.mock.calls.length;

  // Focus is in a text input (the palette search): Ctrl+Z must fall through
  // to the browser's native text undo, not the block-level undo.
  const searchbox = screen.getByRole('searchbox');
  fireEvent.keyDown(searchbox, { key: 'z', ctrlKey: true });
  expect(onChange.mock.calls.length).toBe(callsBefore);
  expect(latest(onChange)).toHaveLength(1);
});

/**
 * Deletes the first block the way a user does: press, then click, the row's
 * Delete button. That unmounts the button, so focus falls back to <body>.
 */
function deleteFirstBlock() {
  const remove = screen.getAllByRole('button', { name: 'Delete block' })[0];
  fireEvent.pointerDown(remove);
  fireEvent.click(remove);
}

it('supports Cmd+Z / Cmd+Shift+Z, claiming the key press only when it acts', () => {
  const onChange = vi.fn();
  const { container } = render(<BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />);
  const root = container.querySelector('.bk-root') as HTMLElement;

  // Nothing to undo yet: the key press is left to the browser.
  expect(fireEvent.keyDown(root, { key: 'z', metaKey: true })).toBe(true);

  deleteFirstBlock();
  expect(latest(onChange)).toHaveLength(1);

  // fireEvent returns false once the handler calls preventDefault.
  expect(fireEvent.keyDown(root, { key: 'z', metaKey: true })).toBe(false);
  expect(latest(onChange)).toHaveLength(2);
  expect(fireEvent.keyDown(root, { key: 'z', metaKey: true, shiftKey: true })).toBe(false);
  expect(latest(onChange)).toHaveLength(1);

  // Nothing left to redo.
  expect(fireEvent.keyDown(root, { key: 'z', metaKey: true, shiftKey: true })).toBe(true);
  expect(latest(onChange)).toHaveLength(1);
});

it('keeps working once focus falls back to the page, after a click in the builder', () => {
  const onChange = vi.fn();
  render(<BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />);

  deleteFirstBlock();
  expect(latest(onChange)).toHaveLength(1);

  // The key press lands on <body>, outside the builder's root.
  expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })).toBe(false);
  expect(latest(onChange)).toHaveLength(2);
  expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true })).toBe(false);
  expect(latest(onChange)).toHaveLength(1);
});

it('leaves the shortcut alone after a click elsewhere on the host page', () => {
  const onChange = vi.fn();
  render(
    <>
      <p>Host page</p>
      <textarea aria-label="Host comment" />
      <BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />
    </>
  );
  deleteFirstBlock();
  const callsBefore = onChange.mock.calls.length;

  // A click on the host page outside the builder, which leaves focus on <body>.
  fireEvent.pointerDown(screen.getByText('Host page'));
  expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })).toBe(true);

  // Typing in the host's own text field keeps the browser's text undo.
  const comment = screen.getByRole('textbox', { name: 'Host comment' });
  fireEvent.pointerDown(comment);
  expect(fireEvent.keyDown(comment, { key: 'z', ctrlKey: true })).toBe(true);

  expect(onChange.mock.calls.length).toBe(callsBefore);
});

it("leaves undo to the browser in a block editor's fields, which render in a portal", async () => {
  const onChange = vi.fn();
  render(<BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />);
  deleteFirstBlock();
  const callsBefore = onChange.mock.calls.length;

  // Open the remaining block's editor popover. React bubbles its key presses
  // up to the builder's root even though it renders outside it.
  const [trigger] = screen.getAllByRole('button', { name: 'Edit block' });
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
  const [field] = await screen.findAllByRole('textbox');
  expect(field.closest('.bk-root')).toBeNull();

  expect(fireEvent.keyDown(field, { key: 'z', ctrlKey: true })).toBe(true);
  expect(onChange.mock.calls.length).toBe(callsBefore);
});

it('skips a key press something in the builder already handled', () => {
  const onChange = vi.fn();
  render(<BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} />);
  deleteFirstBlock();

  const undo = screen.getByRole('button', { name: 'Undo' });
  undo.addEventListener('keydown', (event) => event.preventDefault());
  fireEvent.keyDown(undo, { key: 'z', ctrlKey: true });
  expect(latest(onChange)).toHaveLength(1);
});

it('turns the shortcuts off with undoRedoShortcuts={false}', () => {
  const onChange = vi.fn();
  const { container } = render(
    <BlockKitchen initialBlocks={[section('a'), section('b')]} onChange={onChange} undoRedoShortcuts={false} />
  );
  deleteFirstBlock();

  expect(fireEvent.keyDown(container.querySelector('.bk-root') as HTMLElement, { key: 'z', ctrlKey: true })).toBe(true);
  expect(fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })).toBe(true);
  expect(latest(onChange)).toHaveLength(1);

  // The buttons still work, and their tooltips no longer mention a shortcut.
  const undo = screen.getByRole('button', { name: 'Undo' });
  expect(undo.title).toBe('Undo');
  expect(undo.getAttribute('aria-keyshortcuts')).toBeNull();
  fireEvent.click(undo);
  expect(latest(onChange)).toHaveLength(2);
});

it('shows the shortcuts in the Undo / Redo tooltips, with ⌘ on Apple platforms', () => {
  const { unmount } = render(<BlockKitchen initialBlocks={[section('a')]} />);
  expect(screen.getByRole('button', { name: 'Undo' }).title).toBe('Undo (Ctrl+Z)');
  expect(screen.getByRole('button', { name: 'Redo' }).title).toBe('Redo (Ctrl+Shift+Z)');
  expect(screen.getByRole('button', { name: 'Undo' }).getAttribute('aria-keyshortcuts')).toBe('Control+Z Meta+Z');
  unmount();

  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
  render(<BlockKitchen initialBlocks={[section('a')]} />);
  expect(screen.getByRole('button', { name: 'Undo' }).title).toBe('Undo (⌘Z)');
  expect(screen.getByRole('button', { name: 'Redo' }).title).toBe('Redo (⇧⌘Z)');
});
