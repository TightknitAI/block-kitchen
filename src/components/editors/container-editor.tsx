import { Plus, Trash2 } from 'lucide-react';
import { labelForBlockType } from '../../lib/default-blocks';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import type { ContainerBlock, ContainerChildBlock, SupportedBlockType } from '../../types';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

const MAX_CHILDREN = 10;
const WIDTHS = ['narrow', 'standard', 'wide', 'full'] as const;

/**
 * Editor form for `container` blocks. Edits the container's own fields —
 * title, subtitle, width, collapse behavior, and icon — and lets the user
 * add / remove the child blocks it groups. Child blocks are listed by type
 * with an add (appends a section) and remove affordance; for deeper edits
 * to a child's content, use the View JSON drawer.
 * @param props - editor props
 * @param props.block - the container block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered container editor form
 */
export function ContainerEditor({ block, onChange }: BlockEditorProps<ContainerBlock>) {
  const children = block.child_blocks ?? [];
  // The visual builder only emits URL-based icons; a slack_file icon (rare)
  // reads as empty and is replaced if the user types a URL.
  const iconUrl = block.icon && 'image_url' in block.icon ? (block.icon.image_url ?? '') : '';
  const iconAlt = block.icon?.alt_text ?? '';

  const removeChildAt = (idx: number) => {
    onChange({ ...block, child_blocks: children.filter((_, i) => i !== idx) });
  };
  const addChild = () => {
    const child: ContainerChildBlock = {
      type: 'section',
      text: { type: 'mrkdwn', text: 'New block.' }
    };
    onChange({ ...block, child_blocks: [...children, child] });
  };

  return (
    <div className="flex flex-col gap-4">
      <EditorField label="Title" help="Heading shown at the top of the container." htmlFor="container-title">
        <Input
          id="container-title"
          value={block.title?.text ?? ''}
          maxLength={150}
          placeholder="e.g. Bulk update: 2 records selected"
          onChange={(e) => onChange({ ...block, title: { type: 'plain_text', text: e.target.value } })}
        />
      </EditorField>

      <EditorField label="Subtitle" help="Optional secondary line under the title." htmlFor="container-subtitle">
        <Input
          id="container-subtitle"
          value={block.subtitle?.text ?? ''}
          maxLength={150}
          placeholder="e.g. Review changes before confirming"
          onChange={(e) =>
            onChange({
              ...block,
              subtitle: e.target.value ? { type: 'plain_text', text: e.target.value } : undefined
            })
          }
        />
      </EditorField>

      <EditorField label="Icon URL" help="Optional image shown left of the title." htmlFor="container-icon">
        <Input
          id="container-icon"
          type="url"
          value={iconUrl}
          placeholder="https://example.com/icon.png"
          onChange={(e) =>
            onChange({
              ...block,
              icon: e.target.value
                ? { type: 'image', image_url: e.target.value, alt_text: iconAlt || 'Container icon' }
                : undefined
            })
          }
        />
      </EditorField>

      <EditorField label="Width" help="How wide the container renders in the message.">
        <RadioGroup
          value={block.width ?? 'standard'}
          onValueChange={(v) => onChange({ ...block, width: v as ContainerBlock['width'] })}
          className="flex flex-row flex-wrap gap-3"
        >
          {WIDTHS.map((w) => (
            <div key={w} className="flex items-center gap-1.5">
              <RadioGroupItem value={w} id={`container-width-${w}`} />
              <Label htmlFor={`container-width-${w}`} className="text-xs capitalize">
                {w}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>

      <Checkbox
        id="container-collapsible"
        label="Collapsible"
        help="Let readers expand and collapse the container."
        checked={!!block.is_collapsible}
        // Clearing collapsible must also clear default_collapsed — Slack
        // rejects default_collapsed: true without is_collapsible: true.
        onChange={(checked) =>
          onChange({
            ...block,
            is_collapsible: checked || undefined,
            default_collapsed: checked ? block.default_collapsed : undefined
          })
        }
      />

      <Checkbox
        id="container-default-collapsed"
        label="Collapsed by default"
        help="Start collapsed on first render. Requires Collapsible."
        checked={!!block.default_collapsed}
        disabled={!block.is_collapsible}
        onChange={(checked) => onChange({ ...block, default_collapsed: checked || undefined })}
      />

      <div className="flex flex-col gap-2">
        <Label>Child blocks</Label>
        <p className="text-[11px] leading-snug text-muted-foreground">
          A container holds 1-10 blocks. To edit a child's content, use the View JSON drawer.
        </p>
        {children.map((child, idx) => (
          <div key={idx} className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2">
            <span className="text-xs font-medium text-foreground">
              {idx + 1}. {labelForBlockType(child.type as SupportedBlockType)}
            </span>
            <button
              type="button"
              aria-label="Remove child block"
              onClick={() => removeChildAt(idx)}
              disabled={children.length <= 1}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          onClick={addChild}
          disabled={children.length >= MAX_CHILDREN}
          className="self-start"
        >
          <Plus className="h-3.5 w-3.5" /> Add block
        </Button>
      </div>
    </div>
  );
}

/**
 * Inline labeled checkbox matching the builder's editor styling.
 */
function Checkbox({
  id,
  label,
  help,
  checked,
  disabled,
  onChange
}: {
  id: string;
  label: string;
  help?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer rounded border-input disabled:cursor-not-allowed disabled:opacity-40"
        />
        <Label htmlFor={id} className="cursor-pointer text-xs">
          {label}
        </Label>
      </div>
      {help ? <p className="ml-5 text-[11px] leading-snug text-muted-foreground">{help}</p> : null}
    </div>
  );
}
