/**
 * The two palette hosts either side of the `md` breakpoint: the desktop
 * rail (collapsible from the toolbar) and the mobile sheet (torn down on
 * every close). What's pinned here is the state that has to survive each
 * of those disappearances, plus where focus lands when the sheet opens.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { SupportedBlock } from '../src/types';

/**
 * A draft with something in it, so the empty surface's own "Add a block"
 * button is out of the way and the toolbar's is unambiguous.
 */
const SEED: SupportedBlock[] = [{ type: 'divider' }];

/**
 * Point `matchMedia` at a fixed answer for the mobile query so
 * `useIsMobile` — and with it the palette sheet — can be exercised in
 * jsdom, which reports no viewport of its own.
 */
function setViewport(mobile: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: mobile,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  );
}

/** The palette inside the mobile sheet, once it's open. */
function sheet(): HTMLElement {
  return screen.getByRole('dialog');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it('collapses and restores the desktop palette rail from the toolbar', () => {
  setViewport(false);
  render(<BlockKitchen />);

  expect(screen.getByRole('button', { name: 'Add Divider to preview' })).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Hide block palette' }));
  expect(screen.queryByRole('button', { name: 'Add Divider to preview' })).toBeNull();
  expect(screen.queryByRole('searchbox')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Show block palette' }));
  expect(screen.getByRole('button', { name: 'Add Divider to preview' })).toBeTruthy();
});

it('brings the rail back as it was left', () => {
  setViewport(false);
  render(<BlockKitchen />);

  // A search the user typed before collapsing is still filtering the list
  // on the way back — collapsing hides the rail, it doesn't reset it.
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'divider' } });
  expect(screen.queryByRole('button', { name: 'Add Image to preview' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Hide block palette' }));
  fireEvent.click(screen.getByRole('button', { name: 'Show block palette' }));

  expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('divider');
  expect(screen.queryByRole('button', { name: 'Add Image to preview' })).toBeNull();
});

it('puts the palette in a sheet on mobile, opened from the toolbar', () => {
  setViewport(true);
  render(<BlockKitchen initialBlocks={SEED} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add a block' }));
  expect(within(sheet()).getByRole('button', { name: 'Add Divider' })).toBeTruthy();
});

it('leaves the palette sheet unfocused so nothing pops open on arrival', () => {
  setViewport(true);
  render(<BlockKitchen paletteMode="simple" initialBlocks={SEED} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add a block' }));

  // Radix would otherwise focus the first tabbable node — the Advanced
  // link, whose tooltip opens with it. Focus belongs on the sheet itself.
  const link = within(sheet()).getByRole('button', { name: 'Advanced block palette' });
  expect(document.activeElement).not.toBe(link);
  expect(document.activeElement).toBe(sheet());
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('re-opens the palette sheet on the side of the switch the user left it', () => {
  setViewport(true);
  render(<BlockKitchen paletteMode="simple" initialBlocks={SEED} />);

  fireEvent.click(screen.getByRole('button', { name: 'Add a block' }));
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Advanced block palette' }));
  expect(within(sheet()).getByRole('button', { name: 'Add Divider' })).toBeTruthy();

  // Adding a block closes the sheet, which unmounts the palette with it.
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Add Divider' }));
  expect(screen.queryByRole('dialog')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Add a block' }));
  expect(within(sheet()).getByRole('button', { name: 'Add Divider' })).toBeTruthy();
  expect(within(sheet()).getByRole('button', { name: 'Basic block palette' })).toBeTruthy();

  // And back to basic is still a click away, sheet after sheet.
  fireEvent.click(within(sheet()).getByRole('button', { name: 'Basic block palette' }));
  fireEvent.keyDown(sheet(), { key: 'Escape' });
  fireEvent.click(screen.getByRole('button', { name: 'Add a block' }));
  expect(within(sheet()).queryByRole('button', { name: 'Add Divider' })).toBeNull();
  expect(within(sheet()).getByRole('button', { name: 'Advanced block palette' })).toBeTruthy();
});
