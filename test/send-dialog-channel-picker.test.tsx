import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SendDialog, type SendDialogProps } from '../src/components/send-dialog';
import type { SendPayload, SupportedBlock } from '../src/types';

const BLOCKS = [{ type: 'divider' }] as SupportedBlock[];

const baseProps = {
  open: true,
  onOpenChange: () => {},
  blocks: BLOCKS,
  loadChannels: async () => [
    { id: 'C1', name: 'general' },
    { id: 'C2', name: 'random' },
    { id: 'C3', name: 'release-notes' }
  ],
  loadSendAsUserStatus: async () => ({ canSendAsUser: false, oauthUrl: 'https://example.com/oauth' }),
  onSend: async () => ({ ok: true }),
  errorCount: 0
} satisfies SendDialogProps;

afterEach(() => vi.restoreAllMocks());

const field = () => screen.getByLabelText('Channel') as HTMLInputElement;

/** Render the open dialog and flush the channel + identity loads. */
async function renderDialog(onSend?: (payload: SendPayload) => Promise<{ ok: boolean }>) {
  render(<SendDialog {...baseProps} {...(onSend ? { onSend } : {})} />);
  await act(async () => {});
}

it('shows the default channel with a space after the hash', async () => {
  await renderDialog();
  expect(field().value).toBe('# general');
});

// The picker's popup is portalled out of the dialog; this is the case where
// that could go wrong — a modal Radix dialog hides and blocks its siblings.
it('filters to a channel and sends to the one picked', async () => {
  const onSend = vi.fn(async (_payload: SendPayload) => ({ ok: true }));
  await renderDialog(onSend);

  fireEvent.click(field());
  fireEvent.change(field(), { target: { value: 'rel' } });
  // Scoped to the picker's own listbox — the "Post as" select has options too.
  const list = within(screen.getByRole('listbox', { name: 'Channels' }));
  expect(list.getAllByRole('option').map((o) => o.textContent)).toEqual(['# release-notes']);
  fireEvent.click(list.getByRole('option', { name: '# release-notes' }));

  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await act(async () => {});
  expect(onSend.mock.calls[0][0].channelId).toBe('C3');
});

it('takes Enter as a pick, not as a send', async () => {
  const onSend = vi.fn(async (_payload: SendPayload) => ({ ok: true }));
  await renderDialog(onSend);

  fireEvent.change(field(), { target: { value: 'random' } });
  fireEvent.keyDown(field(), { key: 'Enter' });

  expect(onSend).not.toHaveBeenCalled();
  expect(field().value).toBe('# random');
});
