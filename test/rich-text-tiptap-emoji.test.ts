import type { RichTextBlock } from 'slack-web-api-client';
import {
  detectLossy,
  type EmojiImportResolver,
  proseMirrorToRichText,
  richTextToProseMirror
} from '../src/lib/rich-text-tiptap';

const blockWith = (...inline: unknown[]): RichTextBlock =>
  ({
    type: 'rich_text',
    elements: [{ type: 'rich_text_section', elements: inline }]
  }) as RichTextBlock;

describe('rich-text-tiptap emoji support', () => {
  it('no longer reports emoji as a lossy reason', () => {
    const block = blockWith({ type: 'text', text: 'hi ' }, { type: 'emoji', name: 'wave' });
    expect(detectLossy(block)).toEqual([]);
  });

  it('imports a Slack emoji element into a PM emoji node', () => {
    const doc = richTextToProseMirror(blockWith({ type: 'emoji', name: 'wave', unicode: '1f44b' }));
    const node = (doc.content?.[0].content ?? [])[0];
    expect(node).toMatchObject({
      type: 'emoji',
      attrs: { name: 'wave', unicode: '1f44b', src: null, skinTone: null }
    });
  });

  it('uses the resolver to inject src / unicode / skinTone on import', () => {
    const resolve: EmojiImportResolver = (el) => ({
      name: el.name ?? '',
      src: el.name === 'partyparrot' ? 'https://emoji.test/p.gif' : null,
      unicode: null,
      skinTone: el.skin_tone ?? null
    });
    const doc = richTextToProseMirror(blockWith({ type: 'emoji', name: 'partyparrot' }), resolve);
    expect((doc.content?.[0].content ?? [])[0]).toMatchObject({
      type: 'emoji',
      attrs: { name: 'partyparrot', src: 'https://emoji.test/p.gif' }
    });
  });

  it('exports a PM emoji node to a Slack element with only name (+ skin_tone)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'hi ' },
            { type: 'emoji', attrs: { name: 'wave', src: 'https://x/p.png', unicode: '1f44b', skinTone: 3 } }
          ]
        }
      ]
    };
    const out = proseMirrorToRichText(doc as never);
    const [section] = out.elements as any[];
    expect(section.elements).toEqual([
      { type: 'text', text: 'hi ' },
      { type: 'emoji', name: 'wave', skin_tone: 3 }
    ]);
  });

  it('drops skin_tone when default / out of range and never emits src / unicode', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'emoji', attrs: { name: 'wave', src: 'https://x/p.png', unicode: '1f44b', skinTone: 1 } }]
        }
      ]
    };
    const out = proseMirrorToRichText(doc as never);
    expect((out.elements as any[])[0].elements).toEqual([{ type: 'emoji', name: 'wave' }]);
  });

  it('round-trips a mixed section without losing the emoji', () => {
    const block = blockWith(
      { type: 'text', text: 'wave ' },
      { type: 'emoji', name: 'wave', unicode: '1f44b' },
      { type: 'text', text: ' done' }
    );
    const out = proseMirrorToRichText(richTextToProseMirror(block));
    const names = (out.elements[0] as any).elements.filter((e: any) => e.type === 'emoji').map((e: any) => e.name);
    expect(names).toEqual(['wave']);
  });
});
