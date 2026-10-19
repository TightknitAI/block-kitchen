import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { BlockAction, BlockPosition, SupportedBlock } from '../src/types';

const BLOCKS = [
  { type: 'divider' },
  {
    type: 'container',
    child_blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'All caught up' } }]
  }
] as SupportedBlock[];

/**
 * A host action that records where it was used.
 * @returns the action and its spy
 */
function commentAction() {
  const onSelect = vi.fn<(position: BlockPosition) => void>();
  const action: BlockAction = { id: 'comment', label: 'Comment on block', icon: <svg />, onSelect };
  return { action, onSelect };
}

/**
 * Click every button with a name inside an element.
 * @param element - where to look
 * @param name - the buttons' accessible name
 */
function clickAll(element: HTMLElement, name: string) {
  for (const button of within(element).getAllByRole('button', { name })) {
    fireEvent.click(button);
  }
}

it('marks each block row with where its block sits', () => {
  const { container } = render(<BlockKitchen initialBlocks={BLOCKS} />);

  const rows = [...container.querySelectorAll<HTMLElement>('[data-bk-block-index]')].map((row) => [
    row.dataset.bkBlockIndex,
    row.dataset.bkChildIndex
  ]);
  expect(rows).toEqual([
    ['0', undefined],
    ['1', undefined],
    ['1', '0']
  ]);
  expect(container.querySelector('[data-bk-block-index="1"][data-bk-child-index="0"]')?.textContent).toContain(
    'All caught up'
  );
});

it("adds a host's block action to every block's toolbars, told where the block sits", () => {
  const { action, onSelect } = commentAction();
  const { container } = render(<BlockKitchen initialBlocks={BLOCKS} blockActions={[action]} />);
  const row = (selector: string) => container.querySelector<HTMLElement>(selector) as HTMLElement;
  // Both the desktop hover toolbar and the mobile inline row offer it.
  const desktopAndMobile = 2;

  clickAll(row('[data-bk-block-index="0"]'), 'Comment on block');
  expect(onSelect.mock.calls.map(([position]) => position)).toEqual(
    Array(desktopAndMobile).fill({ index: 0, childIndex: null })
  );

  onSelect.mockClear();
  clickAll(row('[data-bk-block-index="1"][data-bk-child-index="0"]'), 'Comment on block');
  expect(onSelect.mock.calls.map(([position]) => position)).toEqual(
    Array(desktopAndMobile).fill({ index: 1, childIndex: 0 })
  );

  // The container's own toolbars, beside its children's.
  expect(
    within(row('[data-bk-block-index="1"]:not([data-bk-child-index])')).getAllByRole('button', {
      name: 'Comment on block'
    })
  ).toHaveLength(2 * desktopAndMobile);
  expect(screen.getAllByRole('button', { name: 'Comment on block' })).toHaveLength(3 * desktopAndMobile);
});

it('adds no block actions unless the host passes some', () => {
  render(<BlockKitchen initialBlocks={BLOCKS} />);
  expect(screen.queryByRole('button', { name: 'Comment on block' })).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Duplicate block' }).length).toBeGreaterThan(0);
});
