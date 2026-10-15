import type { RichTextBlock } from 'slack-web-api-client';
import { detectLossy, proseMirrorToRichText, richTextToProseMirror } from '../src/lib/rich-text-tiptap';

const blockWith = (...inline: unknown[]): RichTextBlock =>
  ({
    type: 'rich_text',
    elements: [{ type: 'rich_text_section', elements: inline }]
  }) as RichTextBlock;

describe('rich-text-tiptap user mentions', () => {
  it('edits a block with a user mention in the WYSIWYG', () => {
    const block = blockWith({ type: 'text', text: 'Hi ' }, { type: 'user', user_id: 'U0ADA' });
    expect(detectLossy(block)).toEqual([]);
  });

  it('keeps bold/italic/strike/underline mentions in the WYSIWYG', () => {
    const block = blockWith({ type: 'user', user_id: 'U0ADA', style: { bold: true, italic: true, underline: true } });
    expect(detectLossy(block)).toEqual([]);
  });

  it('falls back to the structured editor for mention styles it cannot keep', () => {
    const block = blockWith({ type: 'user', user_id: 'U0ADA', style: { highlight: true } });
    expect(detectLossy(block)).toEqual([{ label: 'Mention style: highlight', where: 'elements[0].elements[0]' }]);
  });

  it('falls back to the structured editor for a mention inside a code block', () => {
    const block = {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_preformatted',
          elements: [
            { type: 'text', text: 'ping ' },
            { type: 'user', user_id: 'U0ADA' }
          ]
        }
      ]
    } as RichTextBlock;
    expect(detectLossy(block)).toEqual([{ label: 'In code block: user', where: 'elements[0].elements[1]' }]);
  });

  it('round-trips a mention, its style and the text around it', () => {
    const block = blockWith(
      { type: 'text', text: 'Thanks ' },
      { type: 'user', user_id: 'U0ADA', style: { bold: true } },
      { type: 'text', text: ' and ' },
      { type: 'user', user_id: 'W0GRACE' },
      { type: 'text', text: '!' }
    );
    expect(proseMirrorToRichText(richTextToProseMirror(block))).toEqual(block);
  });

  it('exports only the user id, not the name the picker inserted it with', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'userMention', attrs: { userId: 'U0ADA', name: 'Ada Lovelace' } }]
        }
      ]
    };
    expect(proseMirrorToRichText(doc)).toEqual(blockWith({ type: 'user', user_id: 'U0ADA' }));
  });

  it('drops a code mark from a mention, which Slack rejects on a user element', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'userMention',
              attrs: { userId: 'U0ADA', name: null },
              marks: [{ type: 'code' }, { type: 'italic' }]
            }
          ]
        }
      ]
    };
    expect(proseMirrorToRichText(doc)).toEqual(blockWith({ type: 'user', user_id: 'U0ADA', style: { italic: true } }));
  });

  it('drops a mention without a user id', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'userMention', attrs: { userId: '', name: 'Ada' } }] }]
    };
    expect(proseMirrorToRichText(doc)).toEqual(blockWith());
  });
});

describe('rich-text-tiptap channel mentions', () => {
  it('edits a block with a channel mention in the WYSIWYG', () => {
    const block = blockWith({ type: 'text', text: 'See ' }, { type: 'channel', channel_id: 'C0GENERAL' });
    expect(detectLossy(block)).toEqual([]);
  });

  it('keeps bold/italic/strike/underline channel mentions in the WYSIWYG', () => {
    const block = blockWith({
      type: 'channel',
      channel_id: 'C0GENERAL',
      style: { bold: true, italic: true, strike: true, underline: true }
    });
    expect(detectLossy(block)).toEqual([]);
  });

  it('falls back to the structured editor for unsupported channel styles', () => {
    const block = blockWith({ type: 'channel', channel_id: 'C0GENERAL', style: { highlight: true } });
    expect(detectLossy(block)).toEqual([{ label: 'Channel style: highlight', where: 'elements[0].elements[0]' }]);
  });

  it('falls back to the structured editor rather than dropping a channel without an id', () => {
    const block = blockWith({ type: 'channel', channel_id: '' });
    expect(detectLossy(block)).toEqual([{ label: 'Channel without id', where: 'elements[0].elements[0]' }]);
  });

  it('falls back to the structured editor for a channel inside a code block', () => {
    const block = {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_preformatted',
          elements: [
            { type: 'text', text: 'post in ' },
            { type: 'channel', channel_id: 'C0GENERAL' }
          ]
        }
      ]
    } as RichTextBlock;
    expect(detectLossy(block)).toEqual([{ label: 'In code block: channel', where: 'elements[0].elements[1]' }]);
  });

  it('round-trips channel mentions, styles, and surrounding text', () => {
    const block = blockWith(
      { type: 'text', text: 'Post in ' },
      {
        type: 'channel',
        channel_id: 'C0GENERAL',
        style: { bold: true, italic: true, strike: true, underline: true }
      },
      { type: 'text', text: ' or ' },
      { type: 'channel', channel_id: 'G0PRIVATE' }
    );
    expect(proseMirrorToRichText(richTextToProseMirror(block))).toEqual(block);
  });

  it('exports only the channel id, not the picked name', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'channelMention', attrs: { channelId: 'C0GENERAL', name: 'general' } }]
        }
      ]
    };
    expect(proseMirrorToRichText(doc)).toEqual(blockWith({ type: 'channel', channel_id: 'C0GENERAL' }));
  });

  it('drops a code mark from a channel mention', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'channelMention',
              attrs: { channelId: 'C0GENERAL', name: null },
              marks: [{ type: 'code' }, { type: 'strike' }]
            }
          ]
        }
      ]
    };
    expect(proseMirrorToRichText(doc)).toEqual(
      blockWith({ type: 'channel', channel_id: 'C0GENERAL', style: { strike: true } })
    );
  });
});
