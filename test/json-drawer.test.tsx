import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JsonDrawer } from '../src/components/json-drawer';
import type { SupportedBlock } from '../src/types';

const BLOCKS: SupportedBlock[] = [{ type: 'divider' }];

describe('JsonDrawer', () => {
  it('renders a blank textarea when there are no blocks', () => {
    render(<JsonDrawer open onOpenChange={() => {}} blocks={[]} onApply={() => {}} />);

    expect((screen.getByRole('textbox', { name: 'Block Kit JSON' }) as HTMLTextAreaElement).value).toBe('');
  });

  it('clicking Done closes the panel', () => {
    const onOpenChange = vi.fn();
    render(<JsonDrawer open onOpenChange={onOpenChange} blocks={BLOCKS} onApply={() => {}} />);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an accepted indicator after a valid edit is applied', async () => {
    const onApply = vi.fn();
    render(<JsonDrawer open onOpenChange={() => {}} blocks={BLOCKS} onApply={onApply} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Block Kit JSON' }), {
      target: { value: JSON.stringify([{ type: 'divider' }]) }
    });

    expect(onApply).toHaveBeenCalledWith([{ type: 'divider' }]);
    await screen.findByText('Input accepted');
  });
});
