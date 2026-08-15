/**
 * Simple vs advanced palette (`paletteMode`). The palette's default — the
 * full sectioned list with its search box — is the behaviour every other
 * test already assumes, so what's pinned here is the opt-in simple mode:
 * what it hides, what it still offers, and that "Advanced" gets all of it
 * back without a remount.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { AlignLeft } from 'lucide-react';
import { expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { PaletteSection } from '../src/lib/default-blocks';
import type { SupportedBlock } from '../src/types';

/** The blocks array from the most recent onChange call. */
function latest(onChange: ReturnType<typeof vi.fn>): SupportedBlock[] {
  return onChange.mock.calls.at(-1)?.[0] as SupportedBlock[];
}

it('renders the full palette with its search box by default', () => {
  render(<BlockKitchen />);
  expect(screen.getByRole('searchbox')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add Divider to preview' })).toBeTruthy();
  // No switch to offer: this palette is already showing everything, and its
  // named sections say what it holds — so no title row either.
  expect(screen.queryByRole('button', { name: 'Advanced block palette' })).toBeNull();
  expect(screen.queryByText('Message Elements')).toBeNull();
});

it('offers only the basic block, with no search, in simple mode', () => {
  render(<BlockKitchen paletteMode="simple" />);

  expect(screen.getByRole('button', { name: 'Add Rich Text Section to preview' })).toBeTruthy();
  expect(screen.queryByRole('searchbox')).toBeNull();
  // Neither the other variants nor the section headings they sit under.
  expect(screen.queryByRole('button', { name: 'Add Divider to preview' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Rich Text' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Advanced block palette' })).toBeTruthy();
  // The header names the rail rather than floating the link over blank space.
  expect(screen.getByText('Message Elements')).toBeTruthy();
});

it('adds the basic block from simple mode', () => {
  const onChange = vi.fn();
  render(<BlockKitchen paletteMode="simple" onChange={onChange} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add Rich Text Section to preview' }));
  expect(latest(onChange)).toHaveLength(1);
  expect(latest(onChange)[0].type).toBe('rich_text');
});

it('swaps in the full palette from the Advanced link, and back again', () => {
  render(<BlockKitchen paletteMode="simple" />);

  fireEvent.click(screen.getByRole('button', { name: 'Advanced block palette' }));
  expect(screen.getByRole('searchbox')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add Divider to preview' })).toBeTruthy();

  // The link becomes the way back, so simple mode isn't a one-way door.
  fireEvent.click(screen.getByRole('button', { name: 'Basic block palette' }));
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add Divider to preview' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Add Rich Text Section to preview' })).toBeTruthy();
});

it('drops a stale search query when leaving advanced mode', () => {
  render(<BlockKitchen paletteMode="simple" />);

  fireEvent.click(screen.getByRole('button', { name: 'Advanced block palette' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'divider' } });
  expect(screen.queryByRole('button', { name: 'Add Image to preview' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Basic block palette' }));
  fireEvent.click(screen.getByRole('button', { name: 'Advanced block palette' }));
  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('');
  expect(screen.getByRole('button', { name: 'Add Divider to preview' })).toBeTruthy();
});

it('starts the new mode from the top when the host flips paletteMode', () => {
  const { rerender } = render(<BlockKitchen paletteMode="simple" />);

  // Open the full palette, then have the host switch modes underneath it.
  fireEvent.click(screen.getByRole('button', { name: 'Advanced block palette' }));
  expect(screen.getByRole('button', { name: 'Add Divider to preview' })).toBeTruthy();

  rerender(<BlockKitchen paletteMode="advanced" />);
  expect(screen.queryByRole('button', { name: 'Basic block palette' })).toBeNull();

  // Back to simple: the earlier expansion doesn't carry over.
  rerender(<BlockKitchen paletteMode="simple" />);
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Add Divider to preview' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Advanced block palette' })).toBeTruthy();
});

it('stays advanced when the palette flags no basic variants', () => {
  // A fully custom palette has no `basic` opt-ins, so simple mode has
  // nothing to show — better to render everything than an empty rail.
  const CUSTOM: readonly PaletteSection[] = [
    {
      name: 'Company presets',
      icon: AlignLeft,
      variants: [
        {
          id: 'help_footer',
          label: 'Help footer',
          factory: () => ({ type: 'section', text: { type: 'mrkdwn', text: 'Need help?' } })
        }
      ]
    }
  ];
  render(<BlockKitchen paletteMode="simple" palette={CUSTOM} />);

  expect(screen.getByRole('button', { name: 'Add Help footer to preview' })).toBeTruthy();
  expect(screen.getByRole('searchbox')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Advanced block palette' })).toBeNull();
});

it('lets a custom palette pick its own basic variants', () => {
  const CUSTOM: readonly PaletteSection[] = [
    {
      name: 'Company presets',
      icon: AlignLeft,
      variants: [
        {
          id: 'help_footer',
          label: 'Help footer',
          basic: true,
          factory: () => ({ type: 'section', text: { type: 'mrkdwn', text: 'Need help?' } })
        },
        {
          id: 'company_divider',
          label: 'Company divider',
          factory: () => ({ type: 'divider' })
        }
      ]
    }
  ];
  render(<BlockKitchen paletteMode="simple" palette={CUSTOM} />);

  expect(screen.getByRole('button', { name: 'Add Help footer to preview' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add Company divider to preview' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Advanced block palette' })).toBeTruthy();
});
