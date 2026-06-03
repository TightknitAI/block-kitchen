import { useRef } from 'react';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import type { HeaderLevel, SupportedHeaderBlock } from '../../types';
import { EmojiTextInsertButton } from '../emoji/emoji-text-insert-button';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

const HEADER_MAX = 150;
const HEADER_LEVELS: HeaderLevel[] = [1, 2, 3, 4];

/**
 * Editor form for header blocks. Slack enforces plain text only.
 * Shows a character count against the 150-char Slack limit, plus an
 * optional 1-4 level selector (builder-only extension; Slack ignores it).
 * @param props - editor props
 * @param props.block - the header block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered header editor form
 */
export function HeaderEditor({ block, onChange }: BlockEditorProps<SupportedHeaderBlock>) {
  const text = block.text?.text ?? '';
  const remaining = HEADER_MAX - text.length;
  const level = block.level;
  const inputRef = useRef<HTMLInputElement>(null);
  const setText = (next: string) => onChange({ ...block, text: { type: 'plain_text', text: next, emoji: true } });
  return (
    <div className="flex flex-col gap-3">
      <EditorField
        label="Heading text"
        help={`Plain text only. ${remaining} characters remaining.`}
        htmlFor="header-text"
      >
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            id="header-text"
            value={text}
            maxLength={HEADER_MAX}
            placeholder="e.g. Weekly roundup"
            onChange={(e) => setText(e.target.value)}
          />
          <EmojiTextInsertButton targetRef={inputRef} value={text} onChange={setText} className="shrink-0 border" />
        </div>
      </EditorField>
      <EditorField label="Level" help="Optional. Builder-only extension; Slack's API ignores this value.">
        <RadioGroup
          value={level === undefined ? 'default' : String(level)}
          onValueChange={(v) => {
            if (v === 'default') {
              const { level: _omit, ...rest } = block;
              onChange(rest);
              return;
            }
            const next = Number(v) as HeaderLevel;
            onChange({ ...block, level: next });
          }}
          className="flex flex-row flex-wrap gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="default" id="header-level-default" />
            <Label htmlFor="header-level-default" className="text-xs">
              Default
            </Label>
          </div>
          {HEADER_LEVELS.map((lvl) => (
            <div key={lvl} className="flex items-center gap-1.5">
              <RadioGroupItem value={String(lvl)} id={`header-level-${lvl}`} />
              <Label htmlFor={`header-level-${lvl}`} className="text-xs">
                H{lvl}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>
    </div>
  );
}
