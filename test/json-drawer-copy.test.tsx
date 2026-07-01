import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JsonDrawer } from '../src/components/json-drawer';
import type { SupportedBlock } from '../src/types';

const BLOCKS: SupportedBlock[] = [{ type: 'divider' }];

describe('JsonDrawer copy button', () => {
  afterEach(() => vi.restoreAllMocks());

  it('copies the JSON to the clipboard and flips the icon to a checkmark', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<JsonDrawer open onOpenChange={() => {}} blocks={BLOCKS} onApply={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }));

    expect(writeText).toHaveBeenCalledWith(JSON.stringify(BLOCKS, null, 2));
    // The button re-labels itself once the write resolves — the checkmark state.
    await screen.findByRole('button', { name: 'Copied to clipboard' });
  });
});
