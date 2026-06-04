import { useRef } from 'react';
import { Textarea } from '../../lib/ui/textarea';
import type { MarkdownBlock } from '../../types';
import { EmojiTextInsertButton } from '../emoji/emoji-text-insert-button';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

/**
 * Editor form for markdown blocks. Single textarea for the markdown
 * source. Rendered with GFM (tables, task lists, syntax highlighting)
 * by `slack-blocks-to-jsx` in the preview.
 * @param props - editor props
 * @param props.block - the markdown block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered markdown editor form
 */
export function MarkdownEditor({ block, onChange }: BlockEditorProps<MarkdownBlock>) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const text = block.text ?? '';
  const setText = (next: string) => onChange({ ...block, text: next });
  return (
    <EditorField
      label="Markdown"
      help="Standard markdown with GFM: **bold**, _italic_, lists, tables, ```code```, [links](url)."
      htmlFor="markdown-text"
    >
      <div className="flex items-start gap-1.5">
        <Textarea
          ref={textRef}
          id="markdown-text"
          value={text}
          rows={8}
          placeholder="e.g. **Roadmap**\n\n- Item one\n- Item two"
          onChange={(e) => setText(e.target.value)}
        />
        <EmojiTextInsertButton targetRef={textRef} value={text} onChange={setText} className="mt-1 shrink-0 border" />
      </div>
    </EditorField>
  );
}
