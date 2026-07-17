import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SendDialog, type SendDialogProps } from '../src/components/send-dialog';
import type { SendExtrasContext, SendPayload, SupportedBlock } from '../src/types';

const BLOCKS = [{ type: 'divider' }] as SupportedBlock[];

const baseProps = {
  open: true,
  onOpenChange: () => {},
  blocks: BLOCKS,
  loadChannels: async () => [{ id: 'C1', name: 'general' }],
  loadSendAsUserStatus: async () => ({ canSendAsUser: false, oauthUrl: 'https://example.com/oauth' }),
  onSend: async () => ({ ok: true }),
  errorCount: 0
} satisfies SendDialogProps;

afterEach(() => vi.restoreAllMocks());

it('renders host extras inside the dialog with the current channel + identity', async () => {
  render(
    <SendDialog
      {...baseProps}
      renderSendExtras={({ channelId, sendAsUser }) => (
        <div data-testid="extras-context">{`${channelId}:${sendAsUser}`}</div>
      )}
    />
  );
  // The context reports "nothing selected yet" until the channels load.
  expect(screen.getByTestId('extras-context').textContent).toBe('null:false');
  await act(async () => {}); // flush channel + status loads
  expect(screen.getByTestId('extras-context').textContent).toBe('C1:false');
});

it('delivers values collected via setExtras on payload.extras', async () => {
  const onSend = vi.fn(async (_payload: SendPayload) => ({ ok: true }));
  render(
    <SendDialog
      {...baseProps}
      onSend={onSend}
      renderSendExtras={({ extras, setExtras }) => (
        <label>
          <input
            type="checkbox"
            checked={Boolean(extras.crossPost)}
            onChange={(event) => setExtras({ crossPost: event.target.checked })}
          />
          Also post to the intranet
        </label>
      )}
    />
  );
  await act(async () => {});
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await act(async () => {});
  expect(onSend).toHaveBeenCalledWith({
    channelId: 'C1',
    blocks: BLOCKS,
    sendAsUser: false,
    extras: { crossPost: true }
  });
});

it('sends `extras: {}` when the slot is wired but never collects anything', async () => {
  const onSend = vi.fn(async (_payload: SendPayload) => ({ ok: true }));
  render(<SendDialog {...baseProps} onSend={onSend} renderSendExtras={() => <div>No inputs here</div>} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await act(async () => {});
  expect(onSend.mock.calls[0][0].extras).toEqual({});
});

it('omits `extras` from the payload when the slot is not wired', async () => {
  const onSend = vi.fn(async (_payload: SendPayload) => ({ ok: true }));
  render(<SendDialog {...baseProps} onSend={onSend} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await act(async () => {});
  expect(onSend).toHaveBeenCalledTimes(1);
  expect(onSend.mock.calls[0][0]).not.toHaveProperty('extras');
});

it('resets extras each time the dialog opens', async () => {
  const renderSendExtras = ({ extras, setExtras }: SendExtrasContext) => (
    <button type="button" data-testid="collect" onClick={() => setExtras({ note: 'keep' })}>
      {JSON.stringify(extras)}
    </button>
  );
  const { rerender } = render(<SendDialog {...baseProps} renderSendExtras={renderSendExtras} />);
  await act(async () => {});
  fireEvent.click(screen.getByTestId('collect'));
  expect(screen.getByTestId('collect').textContent).toBe('{"note":"keep"}');

  rerender(<SendDialog {...baseProps} open={false} renderSendExtras={renderSendExtras} />);
  rerender(<SendDialog {...baseProps} renderSendExtras={renderSendExtras} />);
  await act(async () => {});
  expect(screen.getByTestId('collect').textContent).toBe('{}');
});
