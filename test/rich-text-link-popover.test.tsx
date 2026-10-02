import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import type { RichTextBlock } from 'slack-web-api-client';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from '../src/components/editors/rich-text-editor';

const block = (text: string): RichTextBlock => ({
  type: 'rich_text',
  elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text }] }]
});

function lastElements(onChange: ReturnType<typeof vi.fn>) {
  const next = onChange.mock.calls.at(-1)?.[0] as RichTextBlock;
  return (next.elements[0] as { elements: unknown[] }).elements;
}

/** TipTap hangs the editor instance off its ProseMirror root element. */
async function getEditor(container: HTMLElement): Promise<Editor> {
  const dom = await waitFor(() => {
    const el = container.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null;
    expect(el?.editor).toBeTruthy();
    return el as HTMLElement & { editor: Editor };
  });
  return dom.editor;
}

async function renderEditor(text: string) {
  const onChange = vi.fn();
  const { container } = render(<RichTextEditor block={block(text)} onChange={onChange} />);
  const editor = await getEditor(container);
  return { onChange, editor };
}

function openLinkPopover() {
  fireEvent.click(screen.getByRole('button', { name: 'Link' }));
}

describe('RichTextEditor link popover', () => {
  it('asks for text and URL when nothing is selected, then inserts the linked text', async () => {
    const { onChange, editor } = await renderEditor('Read ');
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });

    openLinkPopover();
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'the docs' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com/docs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));

    expect(lastElements(onChange)).toEqual([
      { type: 'text', text: 'Read ' },
      { type: 'link', url: 'https://example.com/docs', text: 'the docs' }
    ]);
    expect(screen.queryByLabelText('Text')).toBeNull();
  });

  it('does not extend the inserted link to text typed right after it', async () => {
    const { onChange, editor } = await renderEditor('Read ');
    act(() => {
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    });

    openLinkPopover();
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'docs' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } });
    fireEvent.keyDown(screen.getByLabelText('URL'), { key: 'Enter' });
    act(() => {
      editor.commands.insertContent(' now');
    });

    expect(lastElements(onChange)).toEqual([
      { type: 'text', text: 'Read ' },
      { type: 'link', url: 'https://example.com', text: 'docs' },
      { type: 'text', text: ' now' }
    ]);
  });

  it('uses the URL as the link text when the text field is left blank', async () => {
    const { onChange } = await renderEditor('');

    openLinkPopover();
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));

    expect(lastElements(onChange)).toEqual([{ type: 'link', url: 'https://example.com', text: 'https://example.com' }]);
  });

  it('requires a URL and rejects unsafe schemes before inserting', async () => {
    const { onChange } = await renderEditor('');

    openLinkPopover();
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'click' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByText('Enter a URL.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'javascript:alert(1)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    expect(screen.getByText(/Only http\(s\), mailto/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('only asks for a URL when text is selected, and links the selection', async () => {
    const { onChange, editor } = await renderEditor('Read docs');
    act(() => {
      editor.commands.setTextSelection({ from: 6, to: 10 });
    });

    openLinkPopover();
    expect(screen.queryByLabelText('Text')).toBeNull();
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));

    expect(lastElements(onChange)).toEqual([
      { type: 'text', text: 'Read ' },
      { type: 'link', url: 'https://example.com', text: 'docs' }
    ]);
  });
});
