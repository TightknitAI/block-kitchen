/**
 * Host block editors (`blockEditors`): a host form that replaces the built-in
 * editor for the blocks it matches, while the block stays ordinary Block Kit.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ActionsBlock, Button } from 'slack-web-api-client';
import { expect, it, vi } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { CustomBlockEditor, CustomBlockEditorProps, SupportedBlock } from '../src/types';

const SHARE_URL = 'https://example.com/share?text=';

/**
 * Builds the block the host editor owns: one button linking to a share URL.
 * @param text - the text the share URL carries
 * @returns the actions block
 */
function shareBlock(text: string): SupportedBlock {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Share' },
        url: `${SHARE_URL}${encodeURIComponent(text)}`
      }
    ]
  };
}

/**
 * The share button of a block {@link shareEditor} matched.
 * @param block - the matched block
 * @returns its only element
 */
function shareButton(block: SupportedBlock): Button {
  return (block as ActionsBlock).elements[0] as Button;
}

/**
 * A host form that edits the share text instead of the raw URL.
 * @param props - {@link CustomBlockEditorProps}
 * @param props.block - the share block
 * @param props.onChange - receives the block with the new URL
 * @returns the form
 */
function ShareForm({ block, onChange }: CustomBlockEditorProps) {
  const button = shareButton(block);
  const text = decodeURIComponent((button.url ?? '').slice(SHARE_URL.length));
  return (
    <label>
      Share text
      <input
        value={text}
        onChange={(e) =>
          onChange({
            ...block,
            elements: [{ ...button, url: `${SHARE_URL}${encodeURIComponent(e.target.value)}` }]
          } as SupportedBlock)
        }
      />
    </label>
  );
}

const shareEditor: CustomBlockEditor = {
  id: 'share',
  label: 'Share button',
  match: (block) =>
    block.type === 'actions' && block.elements.length === 1 && (shareButton(block).url ?? '').startsWith(SHARE_URL),
  component: ShareForm
};

/**
 * Opens the editor popover of the block at a top-level index.
 * @param container - the rendered builder
 * @param index - the block's index in the draft
 * @returns the open popover's dialog
 */
function openEditor(container: HTMLElement, index: number): HTMLElement {
  const row = container.querySelector<HTMLElement>(`[data-bk-block-index="${index}"]`) as HTMLElement;
  fireEvent.click(within(row).getAllByLabelText('Edit block')[0]);
  return screen.getByRole('dialog');
}

/** The blocks array from the most recent onChange call. */
function latest(onChange: ReturnType<typeof vi.fn>): SupportedBlock[] {
  return onChange.mock.calls.at(-1)?.[0] as SupportedBlock[];
}

it("shows the host's form, under its label, for a block it matches", () => {
  const { container } = render(
    <BlockKitchen initialBlocks={[shareBlock('Big news & more')]} blockEditors={[shareEditor]} />
  );

  const editor = openEditor(container, 0);
  expect(within(editor).getByRole('heading', { name: 'Edit Share button' })).toBeTruthy();
  expect((within(editor).getByLabelText('Share text') as HTMLInputElement).value).toBe('Big news & more');
  // The built-in buttons form, which edits the raw URL, is gone.
  expect(within(editor).queryByLabelText(/Link URL/)).toBeNull();
  // The shared chrome stays.
  expect(within(editor).getByLabelText('Block ID')).toBeTruthy();
});

it("saves the host form's edits as ordinary Block Kit", () => {
  const onChange = vi.fn();
  const { container } = render(
    <BlockKitchen initialBlocks={[shareBlock('Hi')]} blockEditors={[shareEditor]} onChange={onChange} />
  );

  fireEvent.change(within(openEditor(container, 0)).getByLabelText('Share text'), {
    target: { value: 'Hi there?' }
  });

  expect(shareButton(latest(onChange)[0]).url).toBe(`${SHARE_URL}Hi%20there%3F`);
});

it('keeps the built-in editor for blocks no host editor matches', () => {
  const plain: SupportedBlock = {
    type: 'actions',
    elements: [{ type: 'button', text: { type: 'plain_text', text: 'Docs' }, url: 'https://example.com/docs' }]
  };
  const { container } = render(<BlockKitchen initialBlocks={[plain]} blockEditors={[shareEditor]} />);

  const editor = openEditor(container, 0);
  expect(within(editor).getByRole('heading', { name: 'Edit Buttons' })).toBeTruthy();
  expect(within(editor).queryByLabelText('Share text')).toBeNull();
  expect(within(editor).getByLabelText(/Link URL/)).toBeTruthy();
});

it('uses the built-in editor for every block when the host passes no editors', () => {
  const { container } = render(<BlockKitchen initialBlocks={[shareBlock('Hi')]} />);

  const editor = openEditor(container, 0);
  expect(within(editor).getByRole('heading', { name: 'Edit Buttons' })).toBeTruthy();
  expect(within(editor).queryByLabelText('Share text')).toBeNull();
});

it('reaches blocks inside a container', () => {
  const nested = { type: 'container', child_blocks: [shareBlock('Inside')] } as SupportedBlock;
  const { container } = render(<BlockKitchen initialBlocks={[nested]} blockEditors={[shareEditor]} />);

  const child = container.querySelector<HTMLElement>(
    '[data-bk-block-index="0"][data-bk-child-index="0"]'
  ) as HTMLElement;
  fireEvent.click(within(child).getAllByLabelText('Edit block')[0]);

  expect((within(screen.getByRole('dialog')).getByLabelText('Share text') as HTMLInputElement).value).toBe('Inside');
});
