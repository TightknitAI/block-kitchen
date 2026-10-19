import { render, screen } from '@testing-library/react';
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

it('adds nothing beside the blocks unless the host asks', () => {
  const { container } = render(<BlockKitchen initialBlocks={BLOCKS} />);
  const row = container.querySelector('[data-bk-block-index="1"]');
  // The block's own row holds its editor trigger directly, with no slot beside it.
  expect(row?.querySelector(':scope > div > [aria-label="Edit block"]')).toBeTruthy();
});
