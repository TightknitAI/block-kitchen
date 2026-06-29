import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, ArrowDown, ArrowUp, Copy, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { containerBodyId } from '../lib/container-blocks';
import { Popover, PopoverContent, PopoverTrigger } from '../lib/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/ui/tooltip';
import type { BuilderBlock, ContainerBlock, PreviewHooks, PreviewTheme, SupportedBlock } from '../types';
import { BlockRow } from './block-row';
import { BlockEditor } from './editors/block-editor';

/**
 * A top-level row for a `container` block. Unlike a leaf {@link BlockRow},
 * the container renders its own Slack-style chrome (icon / title / subtitle)
 * plus a nested, droppable list of its child blocks — so users can drag
 * blocks from the palette or the canvas straight into the container, and
 * reorder or pull them back out. The header is the drag handle and opens the
 * container's field editor; the body is a separate drop zone.
 * @param props - row props
 * @returns the rendered container row
 */
export function ContainerRow({
  builderBlock,
  previewHooks,
  previewTheme,
  errorsByBlockId,
  openBlockId,
  onOpenBlockChange,
  onUpdate,
  onDuplicate,
  onDelete,
  onReorder,
  index,
  total,
  isPaletteDrag = false
}: {
  builderBlock: BuilderBlock;
  previewHooks?: PreviewHooks;
  previewTheme?: PreviewTheme;
  errorsByBlockId?: Map<string, string[]>;
  openBlockId?: string | null;
  onOpenBlockChange?: (id: string | null) => void;
  onUpdate: (id: string, block: SupportedBlock) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onReorder?: (id: string, toIndex: number) => void;
  index?: number;
  total?: number;
  isPaletteDrag?: boolean;
}) {
  const { id } = builderBlock;
  const block = builderBlock.block as ContainerBlock;
  const children = builderBlock.children ?? [];
  const errors = errorsByBlockId?.get(id);
  const hasErrors = !!errors && errors.length > 0;
  const isOpen = openBlockId === id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { role: _dndRole, tabIndex: _dndTabIndex, ...sortableA11yAttrs } = attributes;
  const { setNodeRef: setBodyRef, isOver: isBodyOver } = useDroppable({ id: containerBodyId(id) });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const icon = block.icon && 'image_url' in block.icon ? block.icon.image_url : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('group/container relative mb-2 last:mb-0 hover:z-10', isDragging && 'opacity-40')}
    >
      <div
        className={cn(
          'overflow-hidden rounded-md border bg-card transition-shadow',
          hasErrors ? 'border-destructive/60' : 'border-border'
        )}
      >
        {/* Header — drag handle + click-to-edit the container's fields. */}
        <Popover open={isOpen} onOpenChange={(open) => onOpenBlockChange?.(open ? id : null)}>
          <PopoverTrigger asChild>
            <div
              role="button"
              tabIndex={0}
              aria-label="Edit container"
              {...sortableA11yAttrs}
              {...listeners}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenBlockChange?.(!isOpen ? id : null);
                }
              }}
              className="flex w-full cursor-grab items-center gap-2 border-b bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted active:cursor-grabbing"
            >
              {icon ? (
                <img src={icon} alt="" aria-hidden="true" className="h-5 w-5 shrink-0 rounded object-cover" />
              ) : null}
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-semibold text-foreground">
                  {block.title?.text || 'Container'}
                </span>
                {block.subtitle?.text ? (
                  <span className="truncate text-[11px] text-muted-foreground">{block.subtitle.text}</span>
                ) : null}
              </span>
              <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Container
              </span>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-[min(32rem,calc(100vw-1.5rem))] sm:w-[32rem]" align="start">
            <BlockEditor block={block} errors={errors} onChange={(next) => onUpdate(id, next)} />
          </PopoverContent>
        </Popover>

        {/* Body — the child drop zone. */}
        <div
          ref={setBodyRef}
          className={cn(
            'flex flex-col gap-2 p-3 transition-colors',
            isPaletteDrag && 'outline-2 -outline-offset-2 outline-dashed outline-primary/40',
            isPaletteDrag && isBodyOver && 'bg-primary/5'
          )}
        >
          {children.length === 0 ? (
            <div
              className={cn(
                'flex items-center justify-center rounded-md border border-dashed px-3 py-6 text-center text-[11px] transition-colors',
                isBodyOver ? 'border-primary/60 text-primary' : 'border-border text-muted-foreground'
              )}
            >
              Drag blocks here
            </div>
          ) : (
            <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {children.map((child, idx) => (
                <BlockRow
                  key={child.id}
                  builderBlock={child}
                  previewHooks={previewHooks}
                  previewTheme={previewTheme}
                  errors={errorsByBlockId?.get(child.id)}
                  isOpen={openBlockId === child.id}
                  onOpenChange={(open) => onOpenBlockChange?.(open ? child.id : null)}
                  onUpdate={onUpdate}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  index={idx}
                  total={children.length}
                  onReorder={onReorder}
                  isPaletteDrag={isPaletteDrag}
                />
              ))}
              {isPaletteDrag && isBodyOver ? <DropIndicator /> : null}
            </SortableContext>
          )}
        </div>
      </div>

      {/* Hover toolbar — edit / duplicate / delete / move, mirroring BlockRow. */}
      <div
        className={cn(
          'absolute -top-3 right-2 z-10 hidden items-center gap-0.5 rounded-md border bg-background p-0.5 shadow-sm transition-opacity md:flex',
          hasErrors
            ? 'opacity-100'
            : 'opacity-0 group-hover/container:opacity-100 group-focus-within/container:opacity-100'
        )}
      >
        {hasErrors ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`Show ${errors!.length} validation ${errors!.length === 1 ? 'issue' : 'issues'}`}
                onClick={() => onOpenBlockChange?.(id)}
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
            <ToolbarButton label="Move up" disabled={index === 0} onClick={() => onReorder(id, index - 1)}>
              <ArrowUp className="h-3.5 w-3.5" />
            </ToolbarButton>
            <ToolbarButton label="Move down" disabled={index >= total - 1} onClick={() => onReorder(id, index + 1)}>
              <ArrowDown className="h-3.5 w-3.5" />
            </ToolbarButton>
          </>
        ) : null}
        <ToolbarButton label="Edit" onClick={() => onOpenBlockChange?.(id)}>
          <Pencil className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Duplicate" onClick={() => onDuplicate(id)}>
          <Copy className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton label="Delete" destructive onClick={() => onDelete(id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Mobile inline action bar. */}
      <div className="mt-1 flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 px-2 py-1 md:hidden">
        <span className="truncate text-[11px] font-medium text-muted-foreground">Container</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Edit container"
            onClick={() => onOpenBlockChange?.(id)}
            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Duplicate container"
            onClick={() => onDuplicate(id)}
            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Delete container"
            onClick={() => onDelete(id)}
            className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Compact icon button used in the container's hover toolbar. */
function ToolbarButton({
  label,
  onClick,
  disabled,
  destructive,
  children
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40',
            destructive ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-accent hover:text-foreground'
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Insertion bar shown at the end of the container body while dragging in. */
function DropIndicator() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative my-1 h-0.5 w-full rounded-full bg-primary">
      <span className="-left-1 -top-[3px] absolute h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px_var(--color-background)]" />
    </div>
  );
}
