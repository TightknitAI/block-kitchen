import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { describe, expect, it } from 'vitest';
import { defaultPalette } from '../src/lib/default-blocks';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import type { InputBlock } from '../src/types';

/**
 * Slack documents `min_lines` / `max_lines` (integers, 1-100) on the
 * `rich_text_input` element: https://docs.slack.dev/reference/block-kit/block-elements/rich-text-input-element
 */
function richTextInput(lines: { min_lines?: number; max_lines?: number }): InputBlock {
  const variant = defaultPalette.flatMap((section) => section.variants).find((v) => v.id === 'input_rich_text');
  const block = variant?.factory() as InputBlock;
  return { ...block, element: { ...block.element, ...lines } as InputBlock['element'] };
}

function validate(block: InputBlock) {
  return validateBlockKit(toSlackBlocks([block]), { target: 'blocks', surface: 'modal' });
}

describe('rich_text_input min_lines / max_lines', () => {
  it('keeps both fields in the payload sent to Slack', () => {
    const [sent] = toSlackBlocks([richTextInput({ min_lines: 3, max_lines: 20 })]) as InputBlock[];
    expect(sent.element).toMatchObject({ min_lines: 3, max_lines: 20 });
  });

  it.each([{ min_lines: 1, max_lines: 100 }, { min_lines: 3, max_lines: 20 }, { min_lines: 5 }, { max_lines: 8 }])(
    'accepts %o on a modal',
    (lines) => {
      expect(validate(richTextInput(lines)).errors).toEqual([]);
    }
  );

  it.each([{ min_lines: 0 }, { max_lines: 101 }, { min_lines: 2.5 }])('rejects %o', (lines) => {
    expect(validate(richTextInput(lines)).valid).toBe(false);
  });
});
