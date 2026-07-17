import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
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

// ---------------------------------------------------------------------------
// Send mode: `loading` composes with the send flow; update-in-place still
// requires `editing.onUpdate`.
// ---------------------------------------------------------------------------

it('keeps the plain send button (no update split) when `loading` is wired without `editing`', () => {
  render(<BlockKitchen {...sendProps} loading={{ ...loading, initialTarget: okResult }} />);
  // Loaded banner shows, but with no onUpdate the primary action stays Send.
  expect(screen.getByText(/References an existing message in/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /review & send/i })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /review & update/i })).toBeNull();
});

it('shows the update split button when `loading` pairs with `editing.onUpdate`', () => {
  render(
    <BlockKitchen
      {...sendProps}
      loading={{ ...loading, initialTarget: okResult }}
      editing={{ onUpdate: async () => ({ ok: true }) }}
    />
  );
  expect(screen.getByRole('button', { name: /review & update/i })).toBeTruthy();
});

it('warns when `editing.onUpdate` has no load source at all', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<BlockKitchen {...sendProps} editing={{ onUpdate: async () => ({ ok: true }) }} />);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/`editing.onUpdate` needs a loaded message/));
  expect(screen.queryByRole('button', { name: /find message/i })).toBeNull();
});

// Type-level guarantee: `loading` is a base prop, legal on both branches of
// the union. These lines are enforced by `pnpm typecheck`, not vitest.
const composeOnlyLoading: BlockKitchenProps = { loading };
const sendModeLoading: BlockKitchenProps = { ...sendProps, loading };
void composeOnlyLoading;
void sendModeLoading;
