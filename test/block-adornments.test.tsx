import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { BlockPosition, SupportedBlock } from '../src/types';

const BLOCKS = [
  { type: 'divider' },
  { type: 'section', text: { type: 'mrkdwn', text: 'No comments here' } },
  {
    type: 'container',
    child_blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'All caught up' } }]
  }
] as SupportedBlock[];

/**
 * The text an adornment shows for a block's position.
 * @param position - where the block sits
 * @returns its label
 */
const labelOf = ({ index, childIndex }: BlockPosition) =>
  childIndex === null ? `block ${index}` : `block ${index}.${childIndex}`;

/**
 * A row's desktop hover toolbar, found by its delete button: the first one in
 * the row, since the mobile inline row comes after it.
 * @param row - the block's row
 * @param name - the delete button's accessible name
 * @returns the toolbar
 */
function desktopToolbar(row: HTMLElement, name: string) {
  return within(row).getAllByRole('button', { name })[0].parentElement as HTMLElement;
}

it("shows the host's adornment beside each block, told where the block sits", () => {
  const renderBlockAdornment = vi.fn((position: BlockPosition) =>
    // A block with nothing to show gets nothing.
    position.index === 1 ? null : <span>{labelOf(position)}</span>
  );
  const { container } = render(<BlockKitchen initialBlocks={BLOCKS} renderBlockAdornment={renderBlockAdornment} />);

  const shownIn = (selector: string) => container.querySelector(selector)?.textContent ?? '';
  expect(shownIn('[data-bk-block-index="0"]')).toContain('block 0');
  expect(shownIn('[data-bk-block-index="1"]')).not.toContain('block 1');
  expect(shownIn('[data-bk-block-index="2"][data-bk-child-index="0"]')).toContain('block 2.0');
  expect(screen.getByText('block 2')).toBeTruthy();
  expect(renderBlockAdornment).toHaveBeenCalledWith({ index: 1, childIndex: null });
});

it('keeps the hover toolbar over the block, clear of its adornment', () => {
  const { container } = render(
    <BlockKitchen initialBlocks={BLOCKS} renderBlockAdornment={(position) => <span>{labelOf(position)}</span>} />
  );
  const rows = [
    { selector: '[data-bk-block-index="0"]', label: 'block 0', del: 'Delete block', mobileDel: 'Delete block' },
    {
      selector: '[data-bk-block-index="2"][data-bk-child-index="0"]',
      label: 'block 2.0',
      del: 'Delete block',
      mobileDel: 'Delete block'
    },
    {
      selector: '[data-bk-block-index="2"]:not([data-bk-child-index])',
      label: 'block 2',
      del: 'Delete',
      mobileDel: 'Delete container'
    }
  ];

  for (const { selector, label, del, mobileDel } of rows) {
    const row = container.querySelector<HTMLElement>(selector) as HTMLElement;
    const slot = within(row).getByText(label).parentElement as HTMLElement;
    const sideBySide = slot.parentElement as HTMLElement;
    const column = sideBySide.firstElementChild as HTMLElement;
    // Only the block's column and the adornment's slot sit side by side.
    expect(sideBySide.children).toHaveLength(2);
    expect(sideBySide.lastElementChild).toBe(slot);
    // The floating toolbar is anchored in the block's column, so `right-2`
    // measures from the block's right edge, not the adornment's.
    expect(column.classList).toContain('relative');
    expect(desktopToolbar(row, del).parentElement).toBe(column);
    // The mobile inline row sits under both, outside the side-by-side wrapper.
    const mobileDelete = within(row).getAllByRole('button', { name: mobileDel }).at(-1) as HTMLElement;
    expect(sideBySide.contains(mobileDelete)).toBe(false);
  }
});

it('adds nothing beside the blocks unless the host asks', () => {
  const { container } = render(<BlockKitchen initialBlocks={BLOCKS} />);
  const row = container.querySelector<HTMLElement>('[data-bk-block-index="1"]') as HTMLElement;
  // The block's own row holds its editor trigger directly, with no slot beside it,
  // followed by its type label and hover toolbar.
  const trigger = row.querySelector(':scope > div > [aria-label="Edit block"]');
  const wrapper = trigger?.parentElement as HTMLElement;
  expect(trigger).toBeTruthy();
  expect(wrapper.children).toHaveLength(3);
  expect(wrapper.firstElementChild).toBe(trigger);
  expect(wrapper.lastElementChild).toBe(desktopToolbar(row, 'Delete block'));

  // A container's row holds its card, then its hover toolbar, then the mobile inline row.
  const containerRow = container.querySelector<HTMLElement>(
    '[data-bk-block-index="2"]:not([data-bk-child-index])'
  ) as HTMLElement;
  expect(containerRow.children).toHaveLength(3);
  expect(containerRow.children[1]).toBe(desktopToolbar(containerRow, 'Delete'));
});
