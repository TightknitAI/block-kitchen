import type { RichTextBlock } from 'slack-web-api-client';
import { type PMNode, proseMirrorToRichText, richTextToProseMirror } from '../src/lib/rich-text-tiptap';

const sectionBlock = (...inline: unknown[]): RichTextBlock =>
  ({
    type: 'rich_text',
    elements: [{ type: 'rich_text_section', elements: inline }]
  }) as RichTextBlock;

const paragraphDoc = (...content: PMNode[]): PMNode => ({
  type: 'doc',
  content: [{ type: 'paragraph', content }]
});

const firstSectionElements = (block: RichTextBlock) => (block.elements[0] as { elements: unknown[] }).elements;

describe('rich-text-tiptap hard breaks (Shift+Enter soft line breaks)', () => {
  it('exports a hardBreak node to a newline in the Slack text run', () => {
    const doc = paragraphDoc({ type: 'text', text: 'a' }, { type: 'hardBreak' }, { type: 'text', text: 'b' });
    const out = proseMirrorToRichText(doc);
    expect(firstSectionElements(out)).toEqual([{ type: 'text', text: 'a\nb' }]);
  });

  it('exports consecutive hardBreaks as a blank line (\\n\\n)', () => {
    const doc = paragraphDoc(
      { type: 'text', text: 'a' },
      { type: 'hardBreak' },
      { type: 'hardBreak' },
      { type: 'text', text: 'b' }
    );
    const out = proseMirrorToRichText(doc);
    expect(firstSectionElements(out)).toEqual([{ type: 'text', text: 'a\n\nb' }]);
  });

  it('keeps styled runs separate across a hardBreak but emits the newline', () => {
    const doc = paragraphDoc(
      { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
      { type: 'hardBreak' },
      { type: 'text', text: 'b', marks: [{ type: 'bold' }] }
    );
    const out = proseMirrorToRichText(doc);
    expect(firstSectionElements(out)).toEqual([
      { type: 'text', text: 'a', style: { bold: true } },
      { type: 'text', text: '\n' },
      { type: 'text', text: 'b', style: { bold: true } }
    ]);
  });

  it('imports a newline inside a Slack text run as a hardBreak node', () => {
    const doc = richTextToProseMirror(sectionBlock({ type: 'text', text: 'a\nb' }));
    expect(doc.content?.[0].content).toEqual([
      { type: 'text', text: 'a', marks: [] },
      { type: 'hardBreak' },
      { type: 'text', text: 'b', marks: [] }
    ]);
  });

  it('imports a blank line (\\n\\n) as two hardBreaks', () => {
    const doc = richTextToProseMirror(sectionBlock({ type: 'text', text: 'a\n\nb' }));
    expect(doc.content?.[0].content).toEqual([
      { type: 'text', text: 'a', marks: [] },
      { type: 'hardBreak' },
      { type: 'hardBreak' },
      { type: 'text', text: 'b', marks: [] }
    ]);
  });

  it.each([
    'a\nb',
    'a\n\nb',
    'line1\nline2\nline3',
    '\nleading',
    'trailing\n'
  ])('round-trips a Slack text run with newlines: %p', (text) => {
    const block = sectionBlock({ type: 'text', text });
    const out = proseMirrorToRichText(richTextToProseMirror(block));
    expect(firstSectionElements(out)).toEqual([{ type: 'text', text }]);
  });

  it('round-trips a hardBreak inside a list item', () => {
    const block = {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_list',
          style: 'bullet',
          elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text: 'one\ntwo' }] }]
        }
      ]
    } as RichTextBlock;
    const out = proseMirrorToRichText(richTextToProseMirror(block));
    const list = out.elements[0] as { type: string; elements: { elements: unknown[] }[] };
    expect(list.type).toBe('rich_text_list');
    expect(list.elements[0].elements).toEqual([{ type: 'text', text: 'one\ntwo' }]);
  });
});
