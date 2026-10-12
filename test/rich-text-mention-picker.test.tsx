import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Editor } from '@tiptap/react';
import { type KeyboardEvent, useState } from 'react';
import type { RichTextBlock } from 'slack-web-api-client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import { RichTextEditor } from '../src/components/editors/rich-text-editor';
import { MentionsProvider } from '../src/state/mentions-context';
import type { MentionsConfig, MentionUser, SupportedBlock } from '../src/types';

// ProseMirror measures the caret through Range rects when focus() scrolls the
// selection into view; jsdom implements neither.
beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});

const ADA: MentionUser = { id: 'U0ADA', name: 'Ada Lovelace', avatarUrl: 'https://avatars.test/ada.png' };
const GRACE: MentionUser = { id: 'U0GRACE', name: 'Grace Hopper' };

const block = (...inline: unknown[]): RichTextBlock =>
  ({
    type: 'rich_text',
    elements: [{ type: 'rich_text_section', elements: inline }]
  }) as RichTextBlock;

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

/**
 * Feeds each change back in as the block, as a real host does. Without that
 * the editor re-seeds from the stale initial block once the emoji dataset
 * loads, wiping whatever the test typed.
 */
function ControlledEditor({ initial, onChange }: { initial: RichTextBlock; onChange: (next: RichTextBlock) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <RichTextEditor
      block={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

async function renderEditor(
  initial: RichTextBlock,
  mentions?: MentionsConfig,
  onHostKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void
) {
  const onChange = vi.fn();
  const { container } = render(
    <MentionsProvider mentions={mentions}>
      <div onKeyDown={onHostKeyDown}>
        <ControlledEditor initial={initial} onChange={onChange} />
      </div>
    </MentionsProvider>
  );
  const editor = await getEditor(container);
  act(() => {
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  });
  return { onChange, editor };
}

function typeInto(editor: Editor, text: string) {
  act(() => {
    editor.commands.insertContent(text);
  });
}

/** Waits for the picker to show `text`, past the search debounce. */
function findInPicker(text: string) {
  return screen.findByText(text, undefined, { timeout: 3000 });
}

/** Queried directly: role queries compute accessible names and are slow under a loaded run. */
function pickerList() {
  return document.querySelector('[role="listbox"]');
}

function pressKey(editor: Editor, key: string) {
  fireEvent.keyDown(editor.view.dom, { key });
}

describe('RichTextEditor @ mentions', () => {
  it('searches through the host and inserts the picked person as a user element', async () => {
    const searchUsers = vi.fn().mockResolvedValue([ADA, GRACE]);
    const { onChange, editor } = await renderEditor(block({ type: 'text', text: 'Thanks ' }), { searchUsers });

    typeInto(editor, '@ad');
    await findInPicker('Ada Lovelace');
    expect(searchUsers).toHaveBeenLastCalledWith('ad', { signal: expect.any(AbortSignal) });

    fireEvent.click(screen.getByText('Grace Hopper'));

    expect(lastElements(onChange)).toEqual([
      { type: 'text', text: 'Thanks ' },
      { type: 'user', user_id: 'U0GRACE' },
      { type: 'text', text: ' ' }
    ]);
    await waitFor(() => expect(pickerList()).toBeNull());
    expect(editor.getText()).toBe('Thanks @Grace Hopper ');
  });

  it('picks with the arrow keys and Enter', async () => {
    const searchUsers = vi.fn().mockResolvedValue([ADA, GRACE]);
    const { onChange, editor } = await renderEditor(block(), { searchUsers });

    typeInto(editor, '@');
    await findInPicker('Ada Lovelace');
    pressKey(editor, 'ArrowDown');
    expect(
      Array.from(document.querySelectorAll('[role="option"]')).map((option) => option.getAttribute('aria-selected'))
    ).toEqual(['false', 'true']);
    pressKey(editor, 'Enter');

    expect(lastElements(onChange)).toEqual([
      { type: 'user', user_id: 'U0GRACE' },
      { type: 'text', text: ' ' }
    ]);
  });

  it('opens the picker from the toolbar button', async () => {
    const searchUsers = vi.fn().mockResolvedValue([ADA]);
    const { editor } = await renderEditor(block({ type: 'text', text: 'Hi' }), { searchUsers });

    fireEvent.click(screen.getByLabelText('Mention'));

    await findInPicker('Ada Lovelace');
    expect(searchUsers).toHaveBeenLastCalledWith('', { signal: expect.any(AbortSignal) });
    // The trigger needs a space before it to fire.
    expect(editor.getText()).toBe('Hi @');
  });

  it('closes on Escape without inserting anything, or letting the Escape reach the host', async () => {
    const searchUsers = vi.fn().mockResolvedValue([ADA]);
    // The inline rich text editor discards the whole edit on an Escape.
    const onHostKeyDown = vi.fn();
    const { onChange, editor } = await renderEditor(block(), { searchUsers }, onHostKeyDown);

    typeInto(editor, '@ad');
    await findInPicker('Ada Lovelace');
    pressKey(editor, 'Escape');

    await waitFor(() => expect(pickerList()).toBeNull());
    expect(onHostKeyDown).not.toHaveBeenCalled();
    expect(lastElements(onChange)).toEqual([{ type: 'text', text: '@ad' }]);

    pressKey(editor, 'Escape');
    expect(onHostKeyDown).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when the search fails', async () => {
    const searchUsers = vi.fn().mockRejectedValue(new Error('offline'));
    const { editor } = await renderEditor(block(), { searchUsers });

    typeInto(editor, '@zz');

    await findInPicker('No people match that search.');
  });

  it('does not open for the @ inside an email address', async () => {
    const searchUsers = vi.fn().mockResolvedValue([ADA]);
    const { editor } = await renderEditor(block(), { searchUsers });

    typeInto(editor, 'ada@example');

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(pickerList()).toBeNull();
    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('labels mentions through the host lookup, falling back to the raw id', async () => {
    const getUserName = (userId: string) => (userId === 'U0ADA' ? 'Ada Lovelace' : undefined);
    await renderEditor(block({ type: 'user', user_id: 'U0ADA' }, { type: 'user', user_id: 'U0UNKNOWN' }), {
      searchUsers: vi.fn().mockResolvedValue([]),
      getUserName
    });

    expect(screen.getByText('@Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('@U0UNKNOWN')).toBeTruthy();
  });

  it('round-trips existing mentions without a picker when the host passes no mentions config', async () => {
    const { onChange, editor } = await renderEditor(block({ type: 'user', user_id: 'U0ADA' }));

    expect(screen.queryByLabelText('Mention')).toBeNull();
    expect(screen.getByText('@U0ADA')).toBeTruthy();

    typeInto(editor, ' @ad');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(pickerList()).toBeNull();
    expect(lastElements(onChange)).toEqual([
      { type: 'user', user_id: 'U0ADA' },
      { type: 'text', text: ' @ad' }
    ]);
  });
});

describe('BlockKitchen mentions prop', () => {
  const richText = [block({ type: 'text', text: 'Hi ' }, { type: 'user', user_id: 'U0ADA' })] as SupportedBlock[];

  it('reaches the rich text editor', async () => {
    render(
      <BlockKitchen
        initialBlocks={richText}
        mentions={{ searchUsers: vi.fn().mockResolvedValue([]), getUserName: () => 'Ada Lovelace' }}
      />
    );
    fireEvent.click(screen.getAllByLabelText('Edit block')[0]);

    await screen.findByLabelText('Mention');
    expect(screen.getByText('@Ada Lovelace')).toBeTruthy();
  });

  it('leaves the picker off without it', async () => {
    render(<BlockKitchen initialBlocks={richText} />);
    fireEvent.click(screen.getAllByLabelText('Edit block')[0]);

    await screen.findByText('@U0ADA');
    expect(screen.queryByLabelText('Mention')).toBeNull();
  });
});
