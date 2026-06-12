import { unwrapBlocksInput } from '../src/lib/parse-blocks-input';
import type { SupportedBlock } from '../src/types';

const SAMPLE_BLOCKS: SupportedBlock[] = [
  { type: 'header', text: { type: 'plain_text', text: 'Hi', emoji: true } },
  { type: 'divider' }
];

describe('unwrapBlocksInput', () => {
  it('passes a bare blocks array through unchanged', () => {
    expect(unwrapBlocksInput(SAMPLE_BLOCKS)).toBe(SAMPLE_BLOCKS);
  });

  it('returns an empty array unchanged', () => {
    const empty: SupportedBlock[] = [];
    expect(unwrapBlocksInput(empty)).toBe(empty);
  });

  it('unwraps the Slack message wrapper down to its blocks array', () => {
    const wrapped = { blocks: SAMPLE_BLOCKS };
    expect(unwrapBlocksInput(wrapped)).toBe(SAMPLE_BLOCKS);
  });

  it('ignores other top-level keys on the wrapper', () => {
    const wrapped = {
      text: 'fallback',
      channel: 'C123',
      attachments: [{ foo: 'bar' }],
      blocks: SAMPLE_BLOCKS
    };
    expect(unwrapBlocksInput(wrapped)).toBe(SAMPLE_BLOCKS);
  });

  it.each([
    ['a plain object without blocks', { text: 'hi' }],
    ['an object whose blocks is not an array', { blocks: 'nope' }],
    ['a string', 'just text'],
    ['a number', 42],
    ['null', null],
    ['undefined', undefined]
  ])('returns null for %s', (_label, input) => {
    expect(unwrapBlocksInput(input)).toBeNull();
  });
});
