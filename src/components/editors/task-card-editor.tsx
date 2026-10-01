import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import type { TaskCardBlock, TaskCardStatus, UrlSourceElement } from '../../types';
import { EditorField } from './field';
import { RichTextField } from './rich-text-field';
import type { BlockEditorProps } from './types';

const STATUSES: readonly TaskCardStatus[] = ['pending', 'in_progress', 'complete', 'error'] as const;

/**
 * Editor form for task_card blocks. Edits the task id, title, status,
 * the cited sources list, and the optional rich-text `details` and
 * `output` fields. Details and output are togglable — adding one swaps
 * in an empty rich_text block; removing one drops the field from the
 * payload.
 * @param props - editor props
 * @param props.block - the task_card block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered task_card editor form
 */
export function TaskCardEditor({ block, onChange }: BlockEditorProps<TaskCardBlock>) {
  const status: TaskCardStatus = block.status ?? 'pending';
  return (
    <div className="flex flex-col gap-4">
      <EditorField label="Title" help="Title of the task in plain text." htmlFor="task-card-title">
        <Input
          id="task-card-title"
          value={block.title}
          placeholder="e.g. Reproduce the bug locally"
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </EditorField>

      <EditorField label="Task ID" help="ID for the task." htmlFor="task-card-id">
        <Input
          id="task-card-id"
          value={block.task_id}
          placeholder="e.g. task_1"
          onChange={(e) => onChange({ ...block, task_id: e.target.value })}
        />
      </EditorField>

      <EditorField label="Status" help='The state of a task. Can be "pending", "in_progress", "complete", or "error".'>
        <RadioGroup
          value={status}
          onValueChange={(v) => onChange({ ...block, status: v as TaskCardStatus })}
          className="flex flex-row flex-wrap gap-3"
        >
          {STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <RadioGroupItem value={s} id={`task-card-status-${s}`} />
              <Label htmlFor={`task-card-status-${s}`} className="text-xs capitalize">
                {s.replace('_', ' ')}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>

      <RichTextField
        label="Details"
        help="Details of the task in the form of a single rich_text entity."
        value={block.details}
        onChange={(next) => onChange({ ...block, details: next })}
      />

      <RichTextField
        label="Output"
        help="Output of the task in the form of a single rich_text entity."
        value={block.output}
        onChange={(next) => onChange({ ...block, output: next })}
      />

      <SourcesField
        sources={block.sources ?? []}
        onChange={(next) => onChange({ ...block, sources: next.length > 0 ? next : undefined })}
      />
    </div>
  );
}

/**
 * Sub-editor for the task card's `sources` list. Each source is a
 * `{ text, url }` pair Slack renders as a labeled link beneath the card.
 * @param props - field props
 * @param props.sources - the current sources list
 * @param props.onChange - called with the updated sources list
 * @returns the rendered sources editor
 */
function SourcesField({
  sources,
  onChange
}: {
  sources: UrlSourceElement[];
  onChange: (next: UrlSourceElement[]) => void;
}) {
  const update = (idx: number, change: Partial<UrlSourceElement>) => {
    onChange(sources.map((s, i) => (i === idx ? { ...s, ...change } : s)));
  };
  const removeAt = (idx: number) => onChange(sources.filter((_, i) => i !== idx));
  const addSource = () => {
    onChange([...sources, { type: 'url', url: '', text: '' }]);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <span className="text-xs font-medium text-foreground">Sources</span>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Array of URL source elements used to generate a response.
      </p>
      {sources.map((src, idx) => (
        <div key={idx} className="flex flex-col gap-2 rounded border bg-background p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Source {idx + 1}</span>
            <button
              type="button"
              aria-label="Remove source"
              onClick={() => removeAt(idx)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <EditorField label="Label" htmlFor={`task-card-source-text-${idx}`}>
            <Input
              id={`task-card-source-text-${idx}`}
              value={src.text}
              placeholder="e.g. Runbook"
              onChange={(e) => update(idx, { text: e.target.value })}
            />
          </EditorField>
          <EditorField label="URL" htmlFor={`task-card-source-url-${idx}`}>
            <Input
              id={`task-card-source-url-${idx}`}
              type="url"
              value={src.url}
              placeholder="e.g. https://example.com/runbook"
              onChange={(e) => update(idx, { url: e.target.value })}
            />
          </EditorField>
        </div>
      ))}
      <Button type="button" size="sm" onClick={addSource} className="self-start">
        <Plus className="h-3.5 w-3.5" /> Add source
      </Button>
    </div>
  );
}
