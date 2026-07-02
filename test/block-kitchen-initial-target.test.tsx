import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { EditingConfig, LoadResult, SupportedBlock } from '../src/types';

const baseProps = {
  loadChannels: async () => [{ id: 'C1', name: 'general' }],
  loadSendAsUserStatus: async () => ({ canSendAsUser: false }) as never,
  onSend: async () => ({ ok: true }) as never
};

const target: Extract<LoadResult, { ok: true }> = {
  ok: true,
  channelId: 'C1',
  channelName: 'general',
  ts: '1699999999.000100',
  blocks: [{ type: 'header', text: { type: 'plain_text', text: 'from target' } }] as SupportedBlock[],
  editableVia: 'bot'
};

const editing: EditingConfig = {
  onLoadMessage: async () => ({ ok: false, reason: 'n/a' }),
  onUpdate: async () => ({ ok: true }),
  initialTarget: target
};

afterEach(() => vi.restoreAllMocks());

it('boots straight into edit mode when editing.initialTarget is provided', () => {
  render(<BlockKitchen {...baseProps} editing={editing} />);
  // The edit-mode banner only renders while a message is loaded.
  expect(screen.getByText(/References an existing message in/i)).toBeTruthy();
  expect(screen.getByText('#general')).toBeTruthy();
});

it('warns and prefers the target’s blocks when initialBlocks is also given', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  render(<BlockKitchen {...baseProps} editing={editing} initialBlocks={[{ type: 'divider' }] as SupportedBlock[]} />);
  expect(warn).toHaveBeenCalledOnce();
  expect(warn.mock.calls[0][0]).toMatch(/ignoring `initialBlocks`/);
});
