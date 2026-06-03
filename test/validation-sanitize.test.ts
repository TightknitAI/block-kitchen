import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import { stripCustomEmojiForValidation, VALIDATION_EMOJI_PLACEHOLDER } from '../src/lib/validation-sanitize';
import type { SupportedBlock } from '../src/types';

const richTextWithEmoji = (name: string): SupportedBlock =>
  ({
    type: 'rich_text',
    elements: [
      {
        type: 'rich_text_section',
        elements: [
          { type: 'text', text: 'hi ' },
          { type: 'emoji', name }
        ]
      }
    ]
  }) as unknown as SupportedBlock;

describe('stripCustomEmojiForValidation', () => {
  it('rewrites every rich_text emoji name to the known-valid placeholder', () => {
    const [out] = stripCustomEmojiForValidation([richTextWithEmoji('partyparrot')]) as any;
    const emoji = out.elements[0].elements[1];
    expect(emoji.type).toBe('emoji');
    expect(emoji.name).toBe(VALIDATION_EMOJI_PLACEHOLDER);
  });

  it('rewrites emoji nested deep inside other blocks (e.g. task_card output)', () => {
    const block = {
      type: 'task_card',
      task_id: 't1',
      title: 'Task',
      output: {
        type: 'rich_text',
        elements: [{ type: 'rich_text_section', elements: [{ type: 'emoji', name: 'custom_deep' }] }]
      }
    } as unknown as SupportedBlock;

    const [out] = stripCustomEmojiForValidation([block]) as any;
    expect(out.output.elements[0].elements[0].name).toBe(VALIDATION_EMOJI_PLACEHOLDER);
  });

  it('does not mutate the input block (pure deep copy)', () => {
    const input = richTextWithEmoji('keepme');
    stripCustomEmojiForValidation([input]);
    expect((input as any).elements[0].elements[1].name).toBe('keepme');
  });

  it('leaves non-emoji content and other fields untouched', () => {
    const [out] = stripCustomEmojiForValidation([richTextWithEmoji('x')]) as any;
    expect(out.type).toBe('rich_text');
    expect(out.elements[0].elements[0]).toEqual({ type: 'text', text: 'hi ' });
  });

  it('passes blocks without emoji through structurally unchanged', () => {
    const blocks: SupportedBlock[] = [
      { type: 'divider' },
      { type: 'section', text: { type: 'mrkdwn', text: 'hello' } }
    ];
    expect(stripCustomEmojiForValidation(blocks)).toEqual(blocks);
  });

  it('keeps the validation payload valid for an otherwise-valid rich_text block', () => {
    const payload = stripCustomEmojiForValidation(toSlackBlocks([richTextWithEmoji('some_made_up_custom')]));
    const result = validateBlockKit(payload as any, { target: 'blocks' });
    expect(result.valid).toBe(true);
  });
});
