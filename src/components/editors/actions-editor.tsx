import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { ActionsBlock, Button as SlackButton } from 'slack-web-api-client';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import { AdvancedIdField, EditorField } from './field';
import type { BlockEditorProps } from './types';

type ButtonStyle = 'default' | 'primary' | 'danger';

/**
 * Editor form for actions blocks. v1 supports button elements only.
 * Each button gets: label, optional URL, style (default/primary/danger).
 * @param props - editor props
 * @param props.block - the actions block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered actions editor form
 */
export function ActionsEditor({ block, onChange }: BlockEditorProps<ActionsBlock>) {
  const elements = block.elements ?? [];

  const updateButton = (idx: number, update: Partial<SlackButton>) => {
    const next = elements.map((el, i) => {
      if (i !== idx || el.type !== 'button') {
        return el;
      }
      return { ...el, ...update };
    });
    onChange({ ...block, elements: next });
  };

  const removeAt = (idx: number) => {
    const next = elements.filter((_, i) => i !== idx);
    onChange({ ...block, elements: next });
  };

  const addButton = () => {
    // Use a random suffix rather than `elements.length + 1` so re-adding
    // after a delete can't collide with a surviving button's action_id.
    // Slack rejects duplicate action_ids in the same view/message.
    const next = [
      ...elements,
      {
        type: 'button' as const,
        text: { type: 'plain_text' as const, text: 'Click me', emoji: true },
        action_id: `button_${nanoid(6)}`
      }
    ];
    onChange({ ...block, elements: next });
  };

  return (
    <div className="flex flex-col gap-3">
      {elements.map((el, idx) => {
        if (el.type !== 'button') {
          return (
            <div key={idx} className="rounded border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
              Non-button action item (not editable in v1)
            </div>
          );
        }
        const label = el.text?.text ?? '';
        const url = el.url ?? '';
        const style: ButtonStyle = el.style === 'primary' || el.style === 'danger' ? el.style : 'default';
        return (
          <div key={idx} className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Button {idx + 1}</span>
              <button
                type="button"
                aria-label="Remove button"
                onClick={() => removeAt(idx)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <EditorField label="Label" htmlFor={`btn-label-${idx}`}>
              <Input
                id={`btn-label-${idx}`}
                value={label}
                placeholder="e.g. Learn more"
                onChange={(e) =>
                  updateButton(idx, {
                    text: {
                      type: 'plain_text',
                      text: e.target.value,
                      emoji: true
                    }
                  })
                }
              />
            </EditorField>
            <EditorField
              label="Link URL"
              help="Optional. If set, clicking the button opens this link."
              htmlFor={`btn-url-${idx}`}
            >
              <Input
                id={`btn-url-${idx}`}
                type="url"
                value={url}
                placeholder="e.g. https://example.com"
                onChange={(e) => updateButton(idx, { url: e.target.value || undefined })}
              />
            </EditorField>
            <EditorField label="Style" help="How the button looks in Slack.">
              <RadioGroup
                value={style}
                onValueChange={(v) => {
                  const nextStyle: 'primary' | 'danger' | undefined = v === 'primary' || v === 'danger' ? v : undefined;
                  updateButton(idx, { style: nextStyle });
                }}
                className="flex flex-row gap-3"
              >
                {(['default', 'primary', 'danger'] as const).map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <RadioGroupItem value={s} id={`btn-style-${idx}-${s}`} />
                    <Label htmlFor={`btn-style-${idx}-${s}`} className="text-xs capitalize">
                      {s}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </EditorField>
            <AdvancedIdField
              label="Action ID"
              help="Optional. Sent in the interaction payload so your app knows which button was clicked."
              htmlFor={`btn-action-${idx}`}
              value={el.action_id}
              placeholder="e.g. approve_request"
              onChange={(next) => updateButton(idx, { action_id: next })}
            />
          </div>
        );
      })}
      <Button type="button" size="sm" onClick={addButton} className="self-start">
        <Plus className="h-3.5 w-3.5" /> Add button
      </Button>
    </div>
  );
}
