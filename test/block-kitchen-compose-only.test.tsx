import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { BlockKitchenProps, PrimaryActionContext, SupportedBlock, ValidationSummary } from '../src/types';

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

it('renders the host primaryAction in the toolbar and passes draft + verdict on click', () => {
  const onClick = vi.fn<(context: PrimaryActionContext) => void>();
  render(
    <BlockKitchen
      initialBlocks={[{ type: 'divider' }] as SupportedBlock[]}
      primaryAction={{ label: 'Save template', onClick }}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save template' }));
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(onClick).toHaveBeenCalledWith({
    blocks: [{ type: 'divider' }],
    validation: { valid: true, errorCount: 0, errors: [] },
    loadedMessage: null
  });
});

it('keeps primaryAction enabled for an invalid draft by default', () => {
  const onClick = vi.fn<(context: PrimaryActionContext) => void>();
  // A bare section is invalid Block Kit; a drafter still allows committing it.
  render(
    <BlockKitchen
      initialBlocks={[{ type: 'section' }] as SupportedBlock[]}
      primaryAction={{ label: 'Save template', onClick }}
    />
  );
  const button = screen.getByRole('button', { name: 'Save template' }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  const context = onClick.mock.calls[0][0];
  expect(context.validation.valid).toBe(false);
  expect(context.validation.errorCount).toBeGreaterThan(0);
});

it('disables primaryAction on validation errors when disableWhenInvalid is set', () => {
  render(
    <BlockKitchen
      initialBlocks={[{ type: 'section' }] as SupportedBlock[]}
      primaryAction={{ label: 'Save template', onClick: () => {}, disableWhenInvalid: true }}
    />
  );
  const button = screen.getByRole('button', { name: 'Save template' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
});

it('warns and ignores `primaryAction` when the send trio is wired', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const conflicting = {
    ...sendProps,
    primaryAction: { label: 'Save template', onClick: () => {} }
  } as unknown as BlockKitchenProps;
  render(<BlockKitchen {...conflicting} />);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/`primaryAction` is only available in compose-only/));
  expect(screen.queryByRole('button', { name: 'Save template' })).toBeNull();
  expect(screen.getByRole('button', { name: /review & send/i })).toBeTruthy();
});

it('warns and ignores `renderSendExtras` when the send trio is absent', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const extrasOnly = { renderSendExtras: () => null } as unknown as BlockKitchenProps;
  render(<BlockKitchen {...extrasOnly} />);
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/`renderSendExtras` extends the built-in send dialog/));
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

// Type-level guarantees: the send trio is all-or-nothing; `editing` and
// `renderSendExtras` require it; `primaryAction` excludes it. These lines are
// enforced by `pnpm typecheck` (tsc runs over the test tsconfig), not vitest.
// @ts-expect-error partial send wiring is rejected — the trio is all-or-nothing
const partialWiring: BlockKitchenProps = { loadChannels: sendProps.loadChannels };
// @ts-expect-error `editing` is unavailable without the send trio
const editingWithoutSend: BlockKitchenProps = {
  editing: {
    onLoadMessage: async () => ({ ok: false, reason: 'n/a' }),
    onUpdate: async () => ({ ok: true })
  }
};
// @ts-expect-error `renderSendExtras` extends the send dialog, so it requires the send trio
const extrasWithoutSend: BlockKitchenProps = { renderSendExtras: () => null };
// @ts-expect-error `primaryAction` is unavailable alongside the send trio
const primaryActionWithSend: BlockKitchenProps = {
  ...sendProps,
  primaryAction: { label: 'Save template', onClick: () => {} }
};
void partialWiring;
void editingWithoutSend;
void extrasWithoutSend;
void primaryActionWithSend;
