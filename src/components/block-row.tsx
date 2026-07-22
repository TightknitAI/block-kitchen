import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ArrowDown, ArrowUp, Copy, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { RichTextBlock } from 'slack-web-api-client';
import { cn } from '../lib/cn';
import { Button } from '../lib/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../lib/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/ui/tooltip';
import type { BuilderBlock, PreviewHooks, PreviewTheme, SupportedBlock, SupportedBlockType } from '../types';
import { BlockEditor } from './editors/block-editor';
import { RichTextEditor } from './editors/rich-text-editor';
import { SlackBlockPreview } from './preview/slack-block-preview';

const BLOCK_TYPE_LABELS: Record<SupportedBlockType, string> = {
  section: 'Section',
  header: 'Header',
  divider: 'Divider',
  context: 'Context',
  actions: 'Actions',
  image: 'Image',
  markdown: 'Markdown',
  rich_text: 'Rich Text',
  table: 'Table',
  alert: 'Alert',
  card: 'Card',
  carousel: 'Carousel',
  context_actions: 'Context Actions',
  input: 'Input',
  video: 'Video',
  plan: 'Plan',
  task_card: 'Task Card',
  data_visualization: 'Data Visualization',
  container: 'Container'
};

/**
 * A single row in the preview surface wrapping a block's preview render
 * plus a click-to-edit popover. Renders flush like a real Slack message:
 * no border or background by default. The row itself is the drag handle
 * (Slack Block Builder pattern) — clicks under the 4px activation
 * distance still open the editor. Hover surfaces a faint outline plus a
 * floating toolbar (edit, duplicate, delete) so editor chrome never
 * leaks into the visual approximation.
 * @param props - row props
 * @param props.builderBlock - the block to render
 * @param props.previewHooks - optional directive hooks for the preview
 * @param props.previewTheme - light or dark preview theme
 * @param props.errors - validation errors for this block, if any
 * @param props.isOpen - whether this block's editor popover is open
 * @param props.onOpenChange - called when the popover open state changes
 * @param props.onUpdate - called with the updated block payload
 * @param props.onDuplicate - called when the duplicate affordance is clicked
 * @param props.onDelete - called when the delete affordance is clicked
 * @returns the rendered block row
 */
export function BlockRow({
  builderBlock,
  previewHooks,
  previewTheme,
  errors,
  isOpen,
  onOpenChange,
  onUpdate,
  onDuplicate,
  onDelete,
  index,
  total,
  onReorder,
  isPaletteDrag = false
}: {
  builderBlock: BuilderBlock;
  previewHooks?: PreviewHooks;
  previewTheme?: PreviewTheme;
  /** Validation errors for this block, if any. */
  errors?: string[];
  /** Whether this block's editor popover is open. */
  isOpen?: boolean;
  /** Notified when the popover open state changes. */
  onOpenChange?: (open: boolean) => void;
  onUpdate: (id: string, block: SupportedBlock) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Zero-based index of this row in the surface; powers move up/down. */
  index?: number;
  /** Total number of rows on the surface; powers move up/down. */
  total?: number;
  /** Move this row to a new index. Wires up the keyboard-accessible move buttons. */
  onReorder?: (id: string, toIndex: number) => void;
  /** True while a palette item is being dragged (vs. reordering an existing block). */
  isPaletteDrag?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: builderBlock.id
  });
  // The Popover trigger needs an explicit `role`/`tabIndex` on the div so
  // biome's a11y check accepts `aria-label`; dnd-kit's `attributes` also
  // sets those, so pull them off the spread to avoid TS's
  // duplicate-prop warning. The values match (button / 0), so behavior
  // is unchanged.
  const { role: _dndRole, tabIndex: _dndTabIndex, ...sortableA11yAttrs } = attributes;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const hasErrors = !!errors && errors.length > 0;
  const isRichText = builderBlock.block.type === 'rich_text';
  const [inlineEditing, setInlineEditing] = useState(false);
  // Show the insertion bar only for palette drags; sortable reorders
  // already get strong feedback from verticalListSortingStrategy.
  const showDropIndicator = isPaletteDrag && isOver;

  const preview = <SlackBlockPreview block={builderBlock.block} hooks={previewHooks} theme={previewTheme} />;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group relative mb-2 last:mb-0 hover:z-10 md:mb-0', isDragging && 'opacity-40')}
    >
      {showDropIndicator ? (
        <div
          aria-hidden="true"
          className="-top-1 pointer-events-none absolute right-0 left-0 z-20 h-0.5 rounded-full bg-primary"
        >
          <span className="-left-1 -top-[3px] absolute h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px_var(--color-background)]" />
        </div>
      ) : null}
      <div className="relative w-full">
        {isRichText && inlineEditing ? (
          <RichTextInlineEditor
            block={builderBlock.block as RichTextBlock}
            onSave={(next) => {
              onUpdate(builderBlock.id, next);
              setInlineEditing(false);
            }}
            onCancel={() => setInlineEditing(false)}
          />
        ) : isRichText ? (
          <button
            type="button"
            aria-label="Edit block"
            onClick={() => setInlineEditing(true)}
            {...attributes}
            {...listeners}
            className={cn(
              'block w-full cursor-grab rounded-sm border-0 bg-transparent p-0 text-left transition-shadow hover:shadow-md focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing',
              hasErrors ? 'ring-1 ring-destructive/60 hover:ring-destructive' : 'hover:ring-1 hover:ring-border'
            )}
          >
            {preview}
          </button>
        ) : (
          <Popover open={isOpen} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                aria-label="Edit block"
                {...sortableA11yAttrs}
                {...listeners}
                onKeyDown={(e) => {
                  // The div trigger is keyboard-activatable via role="button" + tabIndex=0,
                  // but Space on a non-button element scrolls the page by default. Toggle the
                  // popover ourselves on Enter/Space and swallow the event so the page stays put.
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenChange?.(!isOpen);
                  }
                }}
                className={cn(
                  'block w-full cursor-grab rounded-sm transition-shadow hover:shadow-md focus-visible:ring-1 focus-visible:ring-ring active:cursor-grabbing',
                  hasErrors ? 'ring-1 ring-destructive/60 hover:ring-destructive' : 'hover:ring-1 hover:ring-border'
                )}
              >
                {preview}
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[min(32rem,calc(100vw-1.5rem))] sm:w-[32rem]" align="start">
              <BlockEditor
                block={builderBlock.block}
                errors={errors}
                onChange={(next) => onUpdate(builderBlock.id, next)}
                onDone={() => onOpenChange?.(false)}
              />
            </PopoverContent>
          </Popover>
        )}
        <span className="-translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 z-10 hidden bg-background px-1.5 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block">
          {BLOCK_TYPE_LABELS[builderBlock.block.type]}
        </span>
        {/* Desktop action toolbar. Hover-reveal floating above the block —
            crowded but only one is visible at a time so the overlap is
            invisible. Hidden on mobile in favor of the inline row below. */}
        <div
          className={cn(
            // Hidden on mobile in favor of the inline row below; on desktop
            // reveal on hover, on focus inside the row (so Tab-stops on the
            // floating buttons themselves keep them visible), and when there
            // are validation errors worth surfacing immediately.
            'absolute -top-3 right-2 z-10 hidden items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm transition-opacity md:flex',
            hasErrors ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          )}
        >
          {hasErrors ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Show ${errors!.length} validation ${errors!.length === 1 ? 'issue' : 'issues'}`}
                  onClick={() => onOpenChange?.(true)}
                  className="flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" align="end">
                <ul className="flex flex-col gap-0.5">
                  {errors!.slice(0, 4).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {errors!.length > 4 ? <li className="text-muted-foreground">and {errors!.length - 4} more</li> : null}
                </ul>
              </TooltipContent>
            </Tooltip>
          ) : null}
          {onReorder && typeof index === 'number' && typeof total === 'number' ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Move block up"
                    disabled={index === 0}
                    onClick={() => onReorder(builderBlock.id, index - 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Move up</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Move block down"
                    disabled={index >= total - 1}
                    onClick={() => onReorder(builderBlock.id, index + 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">Move down</TooltipContent>
              </Tooltip>
            </>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Edit block"
                onClick={() => {
                  if (isRichText) {
                    setInlineEditing(true);
                  } else {
                    onOpenChange?.(true);
                  }
                }}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Duplicate block"
                onClick={() => onDuplicate(builderBlock.id)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Duplicate</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Delete block"
                onClick={() => onDelete(builderBlock.id)}
                className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">Delete</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {/* Mobile-only inline action bar. Lives in the flow under the block
          preview so it never overlaps content (the floating desktop bar
          gets in its own way when every row shows it). Type label sits on
          the left, action triplet on the right. */}
      <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 px-2 py-1 md:hidden">
        <span className="truncate text-[11px] font-medium text-muted-foreground">
          {BLOCK_TYPE_LABELS[builderBlock.block.type]}
        </span>
        <div className="flex items-center gap-1">
          {hasErrors ? (
            <button
              type="button"
              aria-label={`Show ${errors!.length} validation ${errors!.length === 1 ? 'issue' : 'issues'}`}
              onClick={() => onOpenChange?.(true)}
              className="flex h-9 w-9 items-center justify-center rounded text-destructive hover:bg-destructive/10"
            >
              <AlertTriangle className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Edit block"
            onClick={() => {
              if (isRichText) {
                setInlineEditing(true);
              } else {
                onOpenChange?.(true);
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Duplicate block"
            onClick={() => onDuplicate(builderBlock.id)}
            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Delete block"
            onClick={() => onDelete(builderBlock.id)}
            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline rich_text editor with explicit Save/Cancel. Holds a local
 * draft so edits don't propagate to the parent block until the user
 * clicks Save. Esc cancels.
 * @param props - editor props
 * @param props.block - the rich_text block to edit
 * @param props.onSave - called with the saved block payload
 * @param props.onCancel - called when the user discards changes
 * @returns the rendered inline editor
 */
function RichTextInlineEditor({
  block,
  onSave,
  onCancel
}: {
  block: RichTextBlock;
  onSave: (next: RichTextBlock) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RichTextBlock>(block);

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-primary/40 bg-background p-2 shadow-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      <RichTextEditor block={draft} onChange={setDraft} />
      <div className="flex items-center justify-end gap-2 border-t pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => onSave(draft)}>
          Save
        </Button>
      </div>
    </div>
  );
}
