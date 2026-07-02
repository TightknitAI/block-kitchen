import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { BlockKitchenProps, SupportedBlock, ValidationSummary } from '../src/types';

const sendProps = {
  loadChannels: async () => [{ id: 'C1', name: 'general' }],
  loadSendAsUserStatus: async () => ({ canSendAsUser: false, oauthUrl: 'https://example.com/oauth' }),
  onSend: async () => ({ ok: true })
};

afterEach(() => vi.restoreAllMocks());

it('renders no send button in compose-only mode', () => {
  render(<BlockKitchen initialBlocks={[{ type: 'divider' }] as SupportedBlock[]} />);
  expect(screen.queryByRole('button', { name: /review & send/i })).toBeNull();
  // The rest of the builder chrome is unaffected.
  expect(screen.getByRole('button', { name: /view json/i })).toBeTruthy();
});

it('renders the send button when the send trio is wired', () => {
  render(<BlockKitchen {...sendProps} initialBlocks={[{ type: 'divider' }] as SupportedBlock[]} />);
  expect(screen.getByRole('button', { name: /review & send/i })).toBeTruthy();
});

it('reports a clean verdict through onValidationChange for a valid draft', () => {
  const onValidationChange = vi.fn<(summary: ValidationSummary) => void>();
  render(
    <BlockKitchen initialBlocks={[{ type: 'divider' }] as SupportedBlock[]} onValidationChange={onValidationChange} />
  );
  expect(onValidationChange).toHaveBeenCalledTimes(1);
  expect(onValidationChange).toHaveBeenCalledWith({ valid: true, errorCount: 0, errors: [] });
});

it('reports errors through onValidationChange for an invalid draft', () => {
  const onValidationChange = vi.fn<(summary: ValidationSummary) => void>();
  // A bare section (no text, no fields) is invalid Block Kit.
  render(
    <BlockKitchen initialBlocks={[{ type: 'section' }] as SupportedBlock[]} onValidationChange={onValidationChange} />
  );
  expect(onValidationChange).toHaveBeenCalledTimes(1);
  const summary = onValidationChange.mock.calls[0][0];
  expect(summary.valid).toBe(false);
  expect(summary.errorCount).toBeGreaterThan(0);
  expect(summary.errors.length).toBe(summary.errorCount);
});

it('warns on partial send wiring and hides the send button', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const partial = { loadChannels: sendProps.loadChannels } as unknown as BlockKitchenProps;
  render(<BlockKitchen {...partial} />);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/all-or-nothing/));
  expect(screen.queryByRole('button', { name: /review & send/i })).toBeNull();
});

it('warns and ignores `editing` when the send trio is absent', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const editingOnly = {
    editing: {
      onLoadMessage: async () => ({ ok: false as const, reason: 'n/a' }),
      onUpdate: async () => ({ ok: true })
    }
  } as unknown as BlockKitchenProps;
  render(<BlockKitchen {...editingOnly} />);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/`editing` requires the send integration/));
  expect(screen.queryByRole('button', { name: /find message/i })).toBeNull();
});

// Type-level guarantees: the send trio is all-or-nothing, and `editing`
// requires it. These lines are enforced by `pnpm typecheck` (tsc runs over
// the test tsconfig), not by vitest.
// @ts-expect-error partial send wiring is rejected — the trio is all-or-nothing
const partialWiring: BlockKitchenProps = { loadChannels: sendProps.loadChannels };
// @ts-expect-error `editing` is unavailable without the send trio
const editingWithoutSend: BlockKitchenProps = {
  editing: {
    onLoadMessage: async () => ({ ok: false, reason: 'n/a' }),
    onUpdate: async () => ({ ok: true })
  }
};
void partialWiring;
void editingWithoutSend;
