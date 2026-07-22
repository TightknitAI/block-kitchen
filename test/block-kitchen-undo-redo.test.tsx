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
