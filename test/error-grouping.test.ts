import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { groupValidatorErrors, toValidatorSurface } from '../src/lib/error-grouping';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import type { BuilderBlock, SupportedBlock } from '../src/types';

/** Minimal builder block whose only meaningful field for grouping is `id`. */
function builderBlock(id: string, block: SupportedBlock = { type: 'divider' }): BuilderBlock {
  return { id, block };
}

describe('toValidatorSurface', () => {
  it('maps app_home to the validator-native "home"', () => {
    expect(toValidatorSurface('app_home')).toBe('home');
  });

  it.each(['message', 'modal'] as const)('passes %p through unchanged', (surface) => {
    expect(toValidatorSurface(surface)).toBe(surface);
  });
});

describe('groupValidatorErrors', () => {
  it('buckets a block-root error under the matching block id, stripping the prefix', () => {
    const blocks = [builderBlock('a'), builderBlock('b')];
    const { byBlockId, general, total } = groupValidatorErrors(["blocks[0]: missing required property 'text'"], blocks);

    expect(byBlockId.get('a')).toEqual(["missing required property 'text'"]);
    expect(byBlockId.has('b')).toBe(false);
    expect(general).toEqual([]);
    expect(total).toBe(1);
  });

  it('keeps the sub-path as context for nested errors', () => {
    const blocks = [builderBlock('a'), builderBlock('b')];
    const { byBlockId } = groupValidatorErrors(['blocks[1].elements: fewer than 1 items'], blocks);

    expect(byBlockId.get('b')).toEqual(['elements: fewer than 1 items']);
  });

  it('preserves bracket indices in deep element paths', () => {
    const blocks = [builderBlock('a')];
    const { byBlockId } = groupValidatorErrors(['blocks[0].elements[0].type: expected "mrkdwn"'], blocks);

    expect(byBlockId.get('a')).toEqual(['elements[0].type: expected "mrkdwn"']);
  });

  it('handles caveat-helper messages that use a space separator (no colon)', () => {
    const blocks = [builderBlock('a'), builderBlock('b')];
    const { byBlockId } = groupValidatorErrors(
      ["blocks[1].block_id must be unique — 'dup' appears at index 0 and 1"],
      blocks
    );

    expect(byBlockId.get('b')).toEqual(["block_id must be unique — 'dup' appears at index 0 and 1"]);
  });

  it('routes root errors to the general bucket, dropping the (root) sentinel', () => {
    const { byBlockId, general } = groupValidatorErrors(['(root): expected array'], [builderBlock('a')]);

    expect(byBlockId.size).toBe(0);
    expect(general).toEqual(['expected array']);
  });

  it('treats a blocks-array-level error (no index) as general', () => {
    const { general } = groupValidatorErrors(['blocks: fewer than 1 items'], [builderBlock('a')]);

    expect(general).toEqual(['blocks: fewer than 1 items']);
  });

  it('falls back to general (keeping the index hint) when the block index is out of range', () => {
    // Defensive only: the validated payload is always 1:1 with builder blocks,
    // so an unmappable index keeps its `blocks[N]` prefix as a debugging hint.
    const { byBlockId, general } = groupValidatorErrors(
      ["blocks[5]: missing required property 'text'"],
      [builderBlock('a')]
    );

    expect(byBlockId.size).toBe(0);
    expect(general).toEqual(["blocks[5]: missing required property 'text'"]);
  });

  it('accumulates multiple errors for the same block', () => {
    const blocks = [builderBlock('a')];
    const { byBlockId, total } = groupValidatorErrors(
      ["blocks[0]: missing required property 'text'", "blocks[0]: missing required property 'fields'"],
      blocks
    );

    expect(byBlockId.get('a')).toEqual(["missing required property 'text'", "missing required property 'fields'"]);
    expect(total).toBe(2);
  });
});

// Guards the contract between the validator's output format and the parser:
// if the published validator changes its error-string shape (or stops
// collapsing the oneOf cascade), these break loudly instead of silently
// dumping everything into the General bucket.
describe('groupValidatorErrors with the real validator', () => {
  it('collapses an empty context block to a single block-scoped error', () => {
    const blocks: BuilderBlock[] = [
      builderBlock('hdr', { type: 'header', text: { type: 'plain_text', text: 'Hello' } } as SupportedBlock),
      builderBlock('ctx', { type: 'context', elements: [] } as unknown as SupportedBlock)
    ];
    const result = validateBlockKit(toSlackBlocks(blocks.map((b) => b.block)), { target: 'blocks' });
    const grouped = groupValidatorErrors(result.errors, blocks);

    expect(result.valid).toBe(false);
    // The pre-0.1.x validator produced ~25 union-branch errors here.
    expect(grouped.byBlockId.get('ctx')).toHaveLength(1);
    expect(grouped.byBlockId.get('ctx')?.[0]).toMatch(/fewer than 1 item/);
    expect(grouped.byBlockId.has('hdr')).toBe(false);
    expect(grouped.general).toEqual([]);
  });

  it('reports a valid context block as having no errors', () => {
    const blocks: BuilderBlock[] = [
      builderBlock('ctx', { type: 'context', elements: [{ type: 'mrkdwn', text: 'hi' }] } as unknown as SupportedBlock)
    ];
    const result = validateBlockKit(toSlackBlocks(blocks.map((b) => b.block)), { target: 'blocks' });
    const grouped = groupValidatorErrors(result.errors, blocks);

    expect(result.valid).toBe(true);
    expect(grouped.total).toBe(0);
  });
});
