import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { describe, expect, it } from 'vitest';
import { groupValidatorErrors } from '../src/lib/error-grouping';
import type { BuilderBlock, SupportedBlock } from '../src/types';

/**
 * The Advanced fields let people type `block_id` / `action_id` by hand, so the
 * collisions the builder's generated ids used to make impossible are now one
 * keystroke away. These assert the validator reports them and that the error
 * lands on the offending block rather than in the general bucket.
 */
function validateAndGroup(blocks: SupportedBlock[]) {
  const result = validateBlockKit(blocks, { target: 'blocks', surface: 'message' });
  const builder: BuilderBlock[] = blocks.map((block, i) => ({ id: `blk-${i}`, block }));
  return groupValidatorErrors(result.errors, builder);
}

const button = (text: string, action_id: string) =>
  ({ type: 'button', text: { type: 'plain_text', text, emoji: true }, action_id }) as const;

describe('duplicate id validation', () => {
  it('flags two elements sharing an action_id inside one block', () => {
    const grouped = validateAndGroup([{ type: 'actions', elements: [button('A', 'dup'), button('B', 'dup')] }]);

    expect(grouped.byBlockId.get('blk-0')?.[0]).toMatch(/action_id must be unique within the block/);
    expect(grouped.general).toEqual([]);
  });

  it('allows the same action_id in two different blocks', () => {
    const grouped = validateAndGroup([
      { type: 'actions', elements: [button('A', 'same')] },
      { type: 'actions', elements: [button('B', 'same')] }
    ]);

    expect(grouped.total).toBe(0);
  });

  it('flags two blocks sharing a block_id', () => {
    const grouped = validateAndGroup([
      { type: 'section', text: { type: 'mrkdwn', text: 'one' }, block_id: 'dup' },
      { type: 'section', text: { type: 'mrkdwn', text: 'two' }, block_id: 'dup' }
    ]);

    expect(grouped.byBlockId.get('blk-1')?.[0]).toMatch(/block_id must be unique/);
  });
});
