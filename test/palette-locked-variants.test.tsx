/**
 * Palette variant `badge` and `locked`: a tag beside a variant's label, and a
 * variant that shows in the palette (to advertise a block the user's plan
 * doesn't include) without being addable.
 */
import { DndContext } from '@dnd-kit/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { Crown, Share2 } from 'lucide-react';
import { expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import { Palette } from '../src/components/palette';
import type { PaletteSection, PaletteVariant } from '../src/lib/default-blocks';
import type { SupportedBlock } from '../src/types';

const ENTERPRISE = { label: 'Enterprise', icon: Crown };

/**
 * One-section palette holding a single "Share" variant.
 * @param overrides - fields to set on the variant
 * @returns the palette
 */
function sharePalette(overrides: Partial<PaletteVariant>): PaletteSection[] {
  return [
    {
      name: 'Sharing',
      icon: Share2,
      variants: [{ id: 'share', label: 'Share', factory: () => ({ type: 'divider' }), ...overrides }]
    }
  ];
}

it('shows a badge beside an addable variant', () => {
  const onChange = vi.fn();
  render(<BlockKitchen palette={sharePalette({ badge: ENTERPRISE })} onChange={onChange} />);

  expect(screen.getByText('Enterprise')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Add Share to preview' }));
  const [blocks] = onChange.mock.calls.at(-1) as [SupportedBlock[]];
  expect(blocks.map((b) => b.type)).toEqual(['divider']);
});

it("shows a locked variant but won't add it, handing the pick to the host", () => {
  const onChange = vi.fn();
  const onLockedSelect = vi.fn();
  render(
    <BlockKitchen palette={sharePalette({ badge: ENTERPRISE, locked: true, onLockedSelect })} onChange={onChange} />
  );

  expect(screen.queryByRole('button', { name: 'Add Share to preview' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Share (locked, Enterprise)' }));

  expect(onLockedSelect).toHaveBeenCalledTimes(1);
  expect(onChange.mock.calls.flatMap(([blocks]) => blocks as SupportedBlock[])).toEqual([]);
});

it('renders a locked variant with no handler as inert text', () => {
  render(<BlockKitchen palette={sharePalette({ locked: true })} />);

  expect(screen.getByText('Share')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Share/ })).toBeNull();
});

it('lets the mobile sheet close itself before the host handles a locked pick', () => {
  const order: string[] = [];
  render(
    <DndContext>
      <Palette
        variant="sheet"
        sections={sharePalette({ locked: true, onLockedSelect: () => order.push('host') })}
        onAddBlock={() => order.push('added')}
        onLockedPicked={() => order.push('sheet closed')}
      />
    </DndContext>
  );

  expect(screen.queryByRole('button', { name: 'Add Share' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Share (locked)' }));

  expect(order).toEqual(['sheet closed', 'host']);
});
