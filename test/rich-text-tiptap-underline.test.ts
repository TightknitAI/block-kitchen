import type { RichTextBlock } from 'slack-web-api-client';
import { detectLossy, proseMirrorToRichText, richTextToProseMirror } from '../src/lib/rich-text-tiptap';

const sectionBlock = (...inline: unknown[]): RichTextBlock =>
  ({
    type: 'rich_text',
    elements: [{ type: 'rich_text_section', elements: inline }]
  }) as RichTextBlock;

const paragraphDoc = (...content: unknown[]) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content }]
});

const firstSectionElements = (block: RichTextBlock) => (block.elements[0] as { elements: unknown[] }).elements;

describe('rich-text-tiptap underline style', () => {
  it('imports a Slack underline run as an underline mark', () => {
    const doc = richTextToProseMirror(sectionBlock({ type: 'text', text: 'a', style: { underline: true } }));
    expect(doc.content?.[0].content).toEqual([{ type: 'text', text: 'a', marks: [{ type: 'underline' }] }]);
  });

  it('exports an underline mark to a Slack underline style', () => {
    const out = proseMirrorToRichText(paragraphDoc({ type: 'text', text: 'a', marks: [{ type: 'underline' }] }));
    expect(firstSectionElements(out)).toEqual([{ type: 'text', text: 'a', style: { underline: true } }]);
  });

  it('round-trips underline combined with bold', () => {
    const block = sectionBlock({ type: 'text', text: 'hi', style: { bold: true, underline: true } });
    const out = proseMirrorToRichText(richTextToProseMirror(block));
    expect(firstSectionElements(out)).toEqual([{ type: 'text', text: 'hi', style: { bold: true, underline: true } }]);
  });

  it('no longer reports underline as a lossy feature', () => {
    const block = sectionBlock({ type: 'text', text: 'a', style: { underline: true } });
    expect(detectLossy(block)).toEqual([]);
  });
});
