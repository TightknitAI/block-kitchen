import { Plus, Trash2 } from 'lucide-react';
import type { RichTextBlock } from 'slack-web-api-client';
import { Button } from '../../lib/ui/button';
import { Label } from '../../lib/ui/label';
import { RichTextEditor } from './rich-text-editor';

const EMPTY_RICH_TEXT: RichTextBlock = {
  type: 'rich_text',
  elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text: '' }] }]
};

/**
 * Sub-editor for an optional rich-text field on a block (a task card's
 * `details` / `output`, a container's `rich_text_title`). When the field
 * is unset, renders an "Add" button that swaps in an empty rich_text
 * block; once set, renders the standard {@link RichTextEditor} plus a
 * remove affordance.
 * @param props - field props
 * @param props.label - visible label for the field
 * @param props.help - one-line helper text
 * @param props.value - the current rich_text payload, if any
 * @param props.onChange - called with the new payload or `undefined`
 * @returns the rendered field
 */
export function RichTextField({
  label,
  help,
  value,
  onChange
}: {
  label: string;
  help?: string;
  value: RichTextBlock | undefined;
  onChange: (next: RichTextBlock | undefined) => void;
}) {
  if (!value) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => onChange(EMPTY_RICH_TEXT)}
        >
          <Plus className="h-3.5 w-3.5" /> Add {label.toLowerCase()}
        </Button>
        {help && <p className="text-[11px] leading-snug text-muted-foreground">{help}</p>}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={() => onChange(undefined)}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <RichTextEditor block={value} onChange={onChange} />
      {help && <p className="text-[11px] leading-snug text-muted-foreground">{help}</p>}
    </div>
  );
}
