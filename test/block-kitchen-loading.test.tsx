import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import { LoadMessageDialog } from '../src/components/load-message-dialog';
import { TooltipProvider } from '../src/lib/ui/tooltip';
import type {
  BlockKitchenProps,
  LoadedMessage,
  LoadingConfig,
  LoadResult,
  PrimaryActionContext,
  SupportedBlock
} from '../src/types';

const sendProps = {
  loadChannels: async () => [{ id: 'C1', name: 'general' }],
  loadSendAsUserStatus: async () => ({ canSendAsUser: false, oauthUrl: 'https://example.com/oauth' }),
  onSend: async () => ({ ok: true })
};

const okResult: Extract<LoadResult, { ok: true }> = {
  ok: true,
  channelId: 'C1',
  channelName: 'general',
  ts: '1699999999.000100',
  blocks: [{ type: 'header', text: { type: 'plain_text', text: 'loaded blocks' } }] as SupportedBlock[],
  editableVia: 'bot'
};

const LOADED_MESSAGE: LoadedMessage = {
  channelId: 'C1',
  channelName: 'general',
  ts: '1699999999.000100',
  editableVia: 'bot',
  workspaceName: undefined,
  username: undefined,
  iconUrl: undefined
};

const loading: LoadingConfig = { onLoadMessage: async () => okResult };

afterEach(() => vi.restoreAllMocks());

// ---------------------------------------------------------------------------
// Compose-only mode: loading is a composition concern, available without the
// send trio.
// ---------------------------------------------------------------------------

it('renders the Find message entry in compose-only mode when `loading` is configured', () => {
  render(<BlockKitchen loading={loading} />);
  expect(screen.getByRole('button', { name: /find message/i })).toBeTruthy();
  // Still no send button — loading does not drag the send flow in.
  expect(screen.queryByRole('button', { name: /review & send/i })).toBeNull();
});

it('loads a message into the editor in compose-only mode', async () => {
  render(<BlockKitchen loading={loading} />);
  fireEvent.click(screen.getByRole('button', { name: /find message/i }));
  fireEvent.change(screen.getByLabelText('Message link'), {
    target: { value: 'https://ws.slack.com/archives/C1/p1699999999000100' }
  });
  fireEvent.click(screen.getByRole('button', { name: 'Load message' }));
  await act(async () => {});
  // Draft hydrated with the loaded blocks; loaded banner shows.
  expect(screen.getByText(/References an existing message in/i)).toBeTruthy();
  expect(screen.getByText('#general')).toBeTruthy();
});

it('seeds from `loading.initialTarget` at mount in compose-only mode', () => {
  render(<BlockKitchen loading={{ ...loading, initialTarget: okResult }} />);
  expect(screen.getByText(/References an existing message in/i)).toBeTruthy();
});

it('passes the loaded message to primaryAction clicks and clears it on exit', async () => {
  const onClick = vi.fn<(context: PrimaryActionContext) => void>();
  render(
    <BlockKitchen
      loading={{ ...loading, initialTarget: okResult }}
      primaryAction={{ label: 'Save template', onClick }}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
  expect(onClick.mock.calls[0][0].loadedMessage).toEqual(LOADED_MESSAGE);

  // "Switch to a new message" clears the target (and reopens the loader,
  // which we dismiss to get back to the toolbar).
  fireEvent.click(screen.getByRole('button', { name: /switch to a new message/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
  expect(onClick.mock.calls[1][0].loadedMessage).toBeNull();
});

it('reports loaded-message transitions through onLoadedMessageChange', async () => {
  const onLoadedMessageChange = vi.fn<(message: LoadedMessage | null) => void>();
  render(<BlockKitchen loading={{ ...loading, initialTarget: okResult, onLoadedMessageChange }} />);
  // Mount-time initialTarget is reported...
  expect(onLoadedMessageChange).toHaveBeenCalledTimes(1);
  expect(onLoadedMessageChange).toHaveBeenLastCalledWith(LOADED_MESSAGE);
  // ...and exiting reports null.
  fireEvent.click(screen.getByRole('button', { name: /switch to a new message/i }));
  await act(async () => {});
  expect(onLoadedMessageChange).toHaveBeenCalledTimes(2);
  expect(onLoadedMessageChange).toHaveBeenLastCalledWith(null);
});

it('hides the recent-messages picker and warns without a channel source in compose-only mode', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<BlockKitchen loading={{ ...loading, loadRecentMessages: async () => [] }} />);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/`loading.loadRecentMessages` needs a channel list/));
  fireEvent.click(screen.getByRole('button', { name: /find message/i }));
  expect(screen.queryByText(/or pick a recent message/i)).toBeNull();
});

// Two full load-dialog round trips over the whole builder tree — well over
// the default 5s budget on slow CI runners, hence the explicit timeout.
it('re-notifies when the same message is re-loaded with a changed verdict', { timeout: 20000 }, async () => {
  const onLoadedMessageChange = vi.fn<(message: LoadedMessage | null) => void>();
  // The host's verdict changes between loads (e.g. the user signed in and
  // their own message became editable via the user token).
  let verdict: 'bot' | 'user' = 'bot';
  const dynamicLoading: LoadingConfig = {
    onLoadMessage: async () => ({ ...okResult, editableVia: verdict }),
    onLoadedMessageChange
  };
  render(<BlockKitchen loading={dynamicLoading} />);

  const loadVia = async (link: string) => {
    fireEvent.click(screen.getByRole('button', { name: /find message/i }));
    fireEvent.change(screen.getByLabelText('Message link'), { target: { value: link } });
    fireEvent.click(screen.getByRole('button', { name: 'Load message' }));
    await act(async () => {});
  };

  await loadVia('https://ws.slack.com/archives/C1/p1699999999000100');
  expect(onLoadedMessageChange).toHaveBeenCalledTimes(1);
  expect(onLoadedMessageChange.mock.calls[0][0]?.editableVia).toBe('bot');

  verdict = 'user';
  await loadVia('https://ws.slack.com/archives/C1/p1699999999000100');
  // Same channelId + ts, different verdict — dedupe is by value, so the
  // host is told about the fresh editability.
  expect(onLoadedMessageChange).toHaveBeenCalledTimes(2);
  expect(onLoadedMessageChange.mock.calls[1][0]?.editableVia).toBe('user');
});

it('delivers the current target to an onLoadedMessageChange attached after mount', async () => {
  const onLoadedMessageChange = vi.fn<(message: LoadedMessage | null) => void>();
  const { rerender } = render(<BlockKitchen loading={{ ...loading, initialTarget: okResult }} />);
  expect(onLoadedMessageChange).not.toHaveBeenCalled();
  // The host subscribes on a later render (e.g. after async init) — it
  // still receives the already-loaded target.
  rerender(<BlockKitchen loading={{ ...loading, initialTarget: okResult, onLoadedMessageChange }} />);
  await act(async () => {});
  expect(onLoadedMessageChange).toHaveBeenCalledTimes(1);
  expect(onLoadedMessageChange).toHaveBeenLastCalledWith(LOADED_MESSAGE);
});

it('populates the recent-messages picker when a channel source arrives while the dialog is open', async () => {
  const dialogProps = {
    open: true,
    onOpenChange: () => {},
    onLoadMessage: loading.onLoadMessage,
    loadRecentMessages: async () => [],
    onLoaded: () => {},
    onOpenAsNew: () => {}
  };
  const { rerender } = render(
    <TooltipProvider>
      <LoadMessageDialog {...dialogProps} />
    </TooltipProvider>
  );
  // No channel source yet: paste-link only, no channel picker.
  expect(screen.queryByLabelText('Channel')).toBeNull();

  rerender(
    <TooltipProvider>
      <LoadMessageDialog {...dialogProps} loadChannels={async () => [{ id: 'C1', name: 'general' }]} />
    </TooltipProvider>
  );
  await act(async () => {});
  // The picker appears and the channel list is fetched without reopening.
  expect(screen.getByLabelText('Channel')).toBeTruthy();
  expect(screen.getByRole('option', { name: '#general' })).toBeTruthy();
});

// ---------------------------------------------------------------------------
// Send mode: `loading` composes with the send flow; update-in-place still
// requires `onUpdate`.
// ---------------------------------------------------------------------------

it('keeps the plain send button (no update split) when `loading` is wired without `onUpdate`', () => {
  render(<BlockKitchen {...sendProps} loading={{ ...loading, initialTarget: okResult }} />);
  // Loaded banner shows, but with no onUpdate the primary action stays Send.
  expect(screen.getByText(/References an existing message in/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /review & send/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /review & update/i })).toBeNull();
});

it('shows the update split button when `loading` pairs with `onUpdate`', () => {
  render(
    <BlockKitchen
      {...sendProps}
      loading={{ ...loading, initialTarget: okResult }}
      onUpdate={async () => ({ ok: true })}
    />
  );
  expect(screen.getByRole('button', { name: /review & update/i })).toBeTruthy();
});

it('warns when `onUpdate` has no load source at all', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<BlockKitchen {...sendProps} onUpdate={async () => ({ ok: true })} />);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/`onUpdate` needs a loaded message/));
  expect(screen.queryByRole('button', { name: /find message/i })).toBeNull();
});

// Type-level guarantee: `loading` is a base prop, legal on both branches of
// the union. These lines are enforced by `pnpm typecheck`, not vitest.
const composeOnlyLoading: BlockKitchenProps = { loading };
const sendModeLoading: BlockKitchenProps = { ...sendProps, loading };
void composeOnlyLoading;
void sendModeLoading;
