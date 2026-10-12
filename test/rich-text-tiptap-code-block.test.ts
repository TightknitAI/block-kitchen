import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { RichTextBlock } from 'slack-web-api-client';
import { RichTextEditor } from '../src/components/editors/rich-text-editor';
import { detectLossy, proseMirrorToRichText, richTextToProseMirror } from '../src/lib/rich-text-tiptap';

const codeBlock = (...inline: unknown[]): RichTextBlock =>
  ({
    type: 'rich_text',
    elements: [{ type: 'rich_text_preformatted', elements: inline }]
  }) as RichTextBlock;

describe('rich-text-tiptap code blocks', () => {
  it('round-trips a plain-text code block in the WYSIWYG', () => {
    const block = codeBlock({ type: 'text', text: 'npm install\nnpm test' });
    expect(detectLossy(block)).toEqual([]);
    expect(proseMirrorToRichText(richTextToProseMirror(block))).toEqual(block);
  });

  it('falls back to the structured editor for a link or emoji in a code block', () => {
    const block = codeBlock(
      { type: 'text', text: 'see ' },
      { type: 'link', url: 'https://example.com' },
      { type: 'emoji', name: 'wave' }
    );
    expect(detectLossy(block)).toEqual([
      { label: 'In code block: link', where: 'elements[0].elements[1]' },
      { label: 'In code block: emoji', where: 'elements[0].elements[2]' }
    ]);
  });

  it('falls back to the structured editor for styled text in a code block', () => {
    const block = codeBlock({ type: 'text', text: 'loud', style: { bold: true } });
    expect(detectLossy(block)).toEqual([{ label: 'Styled text in code block', where: 'elements[0].elements[0]' }]);
  });

  it('reports an unsupported inline in a code block once', () => {
    const block = codeBlock({ type: 'channel', channel_id: 'C1' });
    expect(detectLossy(block)).toEqual([{ label: 'In code block: channel', where: 'elements[0].elements[0]' }]);
  });

  it('keeps links and emoji outside code blocks in the WYSIWYG', () => {
    const block = {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements: [
            { type: 'link', url: 'https://example.com' },
            { type: 'emoji', name: 'wave' }
          ]
        }
      ]
    } as RichTextBlock;
    expect(detectLossy(block)).toEqual([]);
  });

  it('opens a code block holding a link in the structured editor', () => {
    render(
      createElement(RichTextEditor, {
        block: codeBlock({ type: 'text', text: 'see ' }, { type: 'link', url: 'https://example.com' }),
        onChange: () => {}
      })
    );
    expect(screen.getByText('Editing in structured mode')).toBeTruthy();
  });
});
