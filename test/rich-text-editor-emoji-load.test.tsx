import { act, render, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import type { RichTextBlock } from 'slack-web-api-client';
import { expect, it, vi } from 'vitest';
import { RichTextEditor } from '../src/components/editors/rich-text-editor';
import type { EmojiIndex } from '../src/lib/emoji-data';

// Hold the emoji dataset back so the test decides when it lands.
let releaseIndex: (index: EmojiIndex) => void = () => {};
vi.mock('../src/lib/emoji-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/emoji-data')>()),
  loadEmojiIndex: () =>
    new Promise<EmojiIndex>((resolve) => {
      releaseIndex = resolve;
    })
}));

const block = (text: string): RichTextBlock => ({
  type: 'rich_text',
  elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text }] }]
});

/** TipTap hangs the editor instance off its ProseMirror root element. */
async function getEditor(container: HTMLElement): Promise<Editor> {
  const dom = await waitFor(() => {
    const el = container.querySelector('.ProseMirror') as (HTMLElement & { editor?: Editor }) | null;
    expect(el?.editor).toBeTruthy();
    return el as HTMLElement & { editor: Editor };
  });
  return dom.editor;
}

it('keeps an edit made before the host re-renders with it when the emoji dataset lands', async () => {
  const onChange = vi.fn();
  const { container } = render(<RichTextEditor block={block('Hi')} onChange={onChange} />);
  const editor = await getEditor(container);
  act(() => {
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, ' there');
  });
  expect(onChange).toHaveBeenLastCalledWith(block('Hi there'));

  const { loadEmojiIndex } = await vi.importActual<typeof import('../src/lib/emoji-data')>('../src/lib/emoji-data');
  const index = await loadEmojiIndex();
  await act(async () => {
    releaseIndex(index);
  });

  expect(editor.getText()).toBe('Hi there');
});

it('still re-seeds an untouched editor once the emoji dataset lands', async () => {
  const wave: RichTextBlock = {
    type: 'rich_text',
    elements: [{ type: 'rich_text_section', elements: [{ type: 'emoji', name: 'wave' }] }]
  };
  const { container } = render(<RichTextEditor block={wave} onChange={vi.fn()} />);
  await getEditor(container);
  expect(container.querySelector('[data-emoji="wave"]')?.textContent).toBe(':wave:');

  const { loadEmojiIndex } = await vi.importActual<typeof import('../src/lib/emoji-data')>('../src/lib/emoji-data');
  const index = await loadEmojiIndex();
  await act(async () => {
    releaseIndex(index);
  });

  await waitFor(() => expect(container.querySelector('[data-emoji="wave"]')?.textContent).toBe('👋'));
});
