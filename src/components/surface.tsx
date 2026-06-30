import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { LayoutGrid, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { isSafeImageSrc } from '../lib/url-safety';
import type { BuilderBlock, PreviewHooks, PreviewSurface, PreviewTheme, SupportedBlock } from '../types';
import { BlockRow } from './block-row';
import { ContainerRow } from './container-row';

/**
 * Stable id of the drop target that represents "end of the list".
 * When the user drops a palette item on empty space, this is the
 * `over` id we see on the drop event.
 */
export const SURFACE_DROPPABLE_ID = 'builder-surface';

/**
 * Center preview surface. Renders the blocks as a vertical sortable list
 * inside one of three Slack-style chromes (Message, Modal, App Home),
 * driven by `previewSurface`.
 * @param props - surface props
 * @param props.blocks - blocks to render
 * @param props.workspaceName - cosmetic workspace name shown in chrome
 * @param props.previewHooks - directive replacement hooks
 * @param props.previewTheme - light or dark preview
 * @param props.previewSurface - which surface chrome to render
 * @param props.errorsByBlockId - validation errors keyed by builder block id
 * @param props.openBlockId - id of the block whose editor popover is open
 * @param props.onOpenBlockChange - called when a block's popover open state changes
 * @param props.onUpdate - update handler forwarded to each row
 * @param props.onDuplicate - duplicate handler forwarded to each row
 * @param props.onDelete - delete handler forwarded to each row
 * @returns the rendered preview surface
 */
export function Surface({
  blocks,
  workspaceName,
  authorName,
  authorIcon,
  previewHooks,
  previewTheme,
  previewSurface = 'message',
  errorsByBlockId,
  openBlockId,
  onOpenBlockChange,
  onUpdate,
  onDuplicate,
  onDelete,
  onReorder,
  isPaletteDrag = false,
  onOpenPalette
}: {
  blocks: BuilderBlock[];
  workspaceName?: string;
  /** Author name shown in the message-frame header (overrides `workspaceName`). */
  authorName?: string;
  /** Author avatar URL shown in the message-frame header. */
  authorIcon?: string;
  previewHooks?: PreviewHooks;
  previewTheme?: PreviewTheme;
  previewSurface?: PreviewSurface;
  /** Validation errors keyed by builder block id. */
  errorsByBlockId?: Map<string, string[]>;
  /** Block id whose editor popover is currently open. */
  openBlockId?: string | null;
  /** Notified when a block's popover open state changes. */
  onOpenBlockChange?: (id: string | null) => void;
  onUpdate: (id: string, block: SupportedBlock) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** Move a block to a new index. Powers the keyboard-accessible move up / move down buttons. */
  onReorder?: (id: string, toIndex: number) => void;
  /** True while a palette item is being dragged (vs. reordering an existing block). */
  isPaletteDrag?: boolean;
  /** When provided, the empty state shows a mobile-friendly CTA that opens the palette sheet. */
  onOpenPalette?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: SURFACE_DROPPABLE_ID });
  const isDark = previewTheme === 'dark';

  // Show the end-of-list insertion bar when the cursor is past the last
  // block while dragging a palette item. For reorder we rely on
  // verticalListSortingStrategy's row shift instead.
  const showEndDropZone = isPaletteDrag && isOver && blocks.length > 0;

  const blocksList = (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[180px] flex-col px-3 py-2 transition-colors sm:min-h-[240px] sm:px-5',
        isDark ? 'bg-[#1a1d21]' : 'bg-white',
        isPaletteDrag &&
          (isDark
            ? 'bg-[#22262c] outline-2 outline-primary/40 -outline-offset-2 outline-dashed'
            : 'bg-[#f5f8ff] outline-2 outline-primary/40 -outline-offset-2 outline-dashed'),
        isPaletteDrag && isOver && (isDark ? 'bg-[#2c3036]' : 'bg-[#eaf0ff]')
      )}
    >
      {blocks.length === 0 ? (
        <EmptyState isDark={isDark} isPaletteDrag={isPaletteDrag} isOver={isOver} onOpenPalette={onOpenPalette} />
      ) : (
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {blocks.map((block, idx) =>
            block.block.type === 'container' ? (
              <ContainerRow
                key={block.id}
                builderBlock={block}
                previewHooks={previewHooks}
                previewTheme={previewTheme}
                errorsByBlockId={errorsByBlockId}
                openBlockId={openBlockId}
                onOpenBlockChange={onOpenBlockChange}
                onUpdate={onUpdate}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                index={idx}
                total={blocks.length}
                onReorder={onReorder}
                isPaletteDrag={isPaletteDrag}
              />
            ) : (
              <BlockRow
                key={block.id}
                builderBlock={block}
                previewHooks={previewHooks}
                previewTheme={previewTheme}
                errors={errorsByBlockId?.get(block.id)}
                isOpen={openBlockId === block.id}
                onOpenChange={(open) => onOpenBlockChange?.(open ? block.id : null)}
                onUpdate={onUpdate}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                index={idx}
                total={blocks.length}
                onReorder={onReorder}
                isPaletteDrag={isPaletteDrag}
              />
            )
          )}
          {showEndDropZone ? <DropIndicator /> : null}
        </SortableContext>
      )}
    </div>
  );

  return (
    <main
      aria-label="Block preview"
      // Outer canvas (the area framing the Slack chrome) follows the
      // host theme's --muted token so brand presets reach it. The inner
      // Slack frame keeps Slack's own canvas colors via isDark below,
      // since that surface is mimicking Slack itself.
      className={cn('flex min-w-0 flex-1 flex-col overflow-y-auto bg-muted p-3 sm:p-6')}
    >
      <div className="mx-auto w-full max-w-2xl">
        {previewSurface === 'modal' ? (
          <ModalFrame isDark={isDark}>{blocksList}</ModalFrame>
        ) : previewSurface === 'app_home' ? (
          <AppHomeFrame workspaceName={workspaceName} isDark={isDark}>
            {blocksList}
          </AppHomeFrame>
        ) : (
          <MessageFrame workspaceName={workspaceName} authorName={authorName} authorIcon={authorIcon} isDark={isDark}>
            {blocksList}
          </MessageFrame>
        )}
      </div>
    </main>
  );
}

/**
 * Slack message chrome: avatar + app name + APP badge + timestamp
 * across the top, blocks below. Mimics the library's `<Message>` wrapper
 * without wiring each block through its own library wrapper (so per-block
 * editing affordances still work).
 * @param props - frame props
 * @param props.workspaceName - cosmetic app name shown in the header
 * @param props.isDark - whether to apply the dark Slack canvas colors
 * @param props.children - the blocks list to render inside the frame
 * @returns the rendered message frame
 */
function MessageFrame({
  workspaceName,
  authorName,
  authorIcon,
  isDark,
  children
}: {
  workspaceName?: string;
  authorName?: string;
  authorIcon?: string;
  isDark: boolean;
  children: ReactNode;
}) {
  const displayName = authorName ?? workspaceName ?? 'Your app';
  const initial = displayName.slice(0, 1).toUpperCase();
  // Only render the author image when it's a safe http(s) URL — it flows into
  // an <img src> just like block image URLs do.
  const safeIcon = authorIcon && isSafeImageSrc(authorIcon) ? authorIcon : null;
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-md border',
        isDark ? 'border-[#2c2d30] bg-[#1a1d21]' : 'border-[#e8e8e8] bg-white'
      )}
    >
      <div
        className={cn('flex items-center gap-2 px-5 pt-3 pb-1 text-xs', isDark ? 'text-white/60' : 'text-[#616061]')}
      >
        {safeIcon ? (
          <img src={safeIcon} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
        ) : (
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded text-[12px] font-semibold',
              isDark ? 'bg-white/10 text-white' : 'bg-[#4a154b]/10 text-[#1d1c1d]'
            )}
          >
            {initial}
          </span>
        )}
        <span className={cn('font-bold text-sm', isDark ? 'text-white' : 'text-[#1d1c1d]')}>{displayName}</span>
        <span
          className={cn(
            'rounded px-1 text-[10px] font-semibold',
            isDark ? 'bg-white/10 text-white/70' : 'bg-[#f3f3f3] text-[#616061]'
          )}
        >
          APP
        </span>
        <span>10:37 AM</span>
      </div>
      {children}
    </div>
  );
}

/**
 * Fake Slack modal chrome: rounded box with a header (title + X close),
 * the blocks in the body, and a footer with Cancel + Submit buttons.
 * Buttons are non-interactive in the preview.
 * @param props - frame props
 * @param props.isDark - whether to apply the dark Slack canvas colors
 * @param props.children - the blocks list to render inside the modal body
 * @returns the rendered modal frame
 */
function ModalFrame({ isDark, children }: { isDark: boolean; children: ReactNode }) {
  // The X / Cancel / Submit affordances are visual chrome — they exist to
  // make the preview look like a real Slack modal. They aren't wired to
  // anything, so render them as `<span aria-hidden>` to keep them out of
  // the focus order and the accessibility tree (a keyboard or screen
  // reader user activating a "Submit" button that did nothing would be a
  // worse experience than not seeing the chrome at all).
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border shadow-lg',
        isDark ? 'border-[#2c2d30] bg-[#1a1d21]' : 'border-[#e8e8e8] bg-white'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between border-b px-5 py-3',
          isDark ? 'border-[#2c2d30]' : 'border-[#e8e8e8]'
        )}
      >
        <h2 className={cn('text-base font-bold', isDark ? 'text-white' : 'text-[#1d1c1d]')}>Modal title</h2>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded',
            isDark ? 'text-white/60' : 'text-[#616061]'
          )}
        >
          <X className="h-4 w-4" />
        </span>
      </div>
      {children}
      <div
        aria-hidden="true"
        className={cn(
          'flex items-center justify-end gap-2 border-t px-5 py-3',
          isDark ? 'border-[#2c2d30]' : 'border-[#e8e8e8]'
        )}
      >
        <span
          className={cn(
            'rounded-sm border px-3 py-1.5 text-sm font-medium',
            isDark ? 'border-white/20 bg-transparent text-white' : 'border-[#e8e8e8] bg-white text-[#1d1c1d]'
          )}
        >
          Cancel
        </span>
        <span className="rounded-sm bg-[#007a5a] px-3 py-1.5 text-sm font-bold text-white">Submit</span>
      </div>
    </div>
  );
}

/**
 * App Home tab chrome: app avatar + name on top, Home/Messages/About
 * tab strip below (Home active), then the blocks.
 * @param props - frame props
 * @param props.workspaceName - cosmetic app name shown in the header
 * @param props.isDark - whether to apply the dark Slack canvas colors
 * @param props.children - the blocks list to render inside the frame
 * @returns the rendered app home frame
 */
function AppHomeFrame({
  workspaceName,
  isDark,
  children
}: {
  workspaceName?: string;
  isDark: boolean;
  children: ReactNode;
}) {
  const initial = (workspaceName ?? 'A').slice(0, 1).toUpperCase();
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-md border',
        isDark ? 'border-[#2c2d30] bg-[#1a1d21]' : 'border-[#e8e8e8] bg-white'
      )}
    >
      <div
        className={cn('flex items-center gap-3 border-b px-5 py-3', isDark ? 'border-[#2c2d30]' : 'border-[#e8e8e8]')}
      >
        <span
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded text-sm font-semibold',
            isDark ? 'bg-white/10 text-white' : 'bg-[#f3f3f3] text-[#1d1c1d]'
          )}
        >
          {initial}
        </span>
        <span className={cn('font-bold text-sm', isDark ? 'text-white' : 'text-[#1d1c1d]')}>
          {workspaceName ?? 'Your app'}
        </span>
      </div>
      <div
        className={cn(
          'flex items-center gap-4 border-b px-5 text-sm',
          isDark ? 'border-[#2c2d30]' : 'border-[#e8e8e8]'
        )}
      >
        {(['Home', 'Messages', 'About'] as const).map((tab) => {
          const active = tab === 'Home';
          return (
            <span
              key={tab}
              className={cn(
                'border-b-2 py-2',
                active
                  ? isDark
                    ? 'border-white font-bold text-white'
                    : 'border-[#1d1c1d] font-bold text-[#1d1c1d]'
                  : `border-transparent font-medium ${isDark ? 'text-white/60' : 'text-[#616061]'}`
              )}
            >
              {tab}
            </span>
          );
        })}
      </div>
      {children}
    </div>
  );
}

/**
 * Placeholder shown inside the preview surface when the draft has no
 * blocks. Uses Slack-style explicit colors keyed off `isDark` so the
 * empty state visually matches the rest of the preview chrome and stays
 * consistent regardless of the host app's light/dark theme. While a
 * palette item is being dragged the copy switches to a "Drop here" cue
 * and the icon container brightens to confirm the empty surface itself
 * is the drop target.
 * @param props - empty state props
 * @param props.isDark - whether the dark Slack canvas is active
 * @param props.isPaletteDrag - whether a palette block is currently being dragged
 * @param props.isOver - whether the cursor is currently over the surface
 * @returns the rendered placeholder
 */
function EmptyState({
  isDark,
  isPaletteDrag,
  isOver,
  onOpenPalette
}: {
  isDark: boolean;
  isPaletteDrag: boolean;
  isOver: boolean;
  onOpenPalette?: () => void;
}) {
  const active = isPaletteDrag && isOver;
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center transition-colors',
        active ? 'text-primary' : isDark ? 'text-white/60' : 'text-[#616061]'
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full transition-colors',
          active ? 'bg-primary/15 text-primary' : isDark ? 'bg-white/5' : 'bg-[#f3f3f3]'
        )}
      >
        <LayoutGrid className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <p
          className={cn(
            'text-sm font-semibold transition-colors',
            active ? 'text-primary' : isDark ? 'text-white' : 'text-[#1d1c1d]'
          )}
        >
          {active ? 'Drop to add block' : 'Start adding blocks!'}
        </p>
        <p className="text-xs">
          {active ? (
            'Release to insert it here.'
          ) : (
            <>
              <span className="hidden md:inline">Drag a block from the left, or click one to add it here.</span>
              <span className="md:hidden">Tap “Add a block” below to get started.</span>
            </>
          )}
        </p>
      </div>
      {!active && onOpenPalette ? (
        <button
          type="button"
          onClick={onOpenPalette}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Plus className="h-4 w-4" />
          Add a block
        </button>
      ) : null}
    </div>
  );
}

/**
 * Insertion bar shown at the cursor's drop target while a palette item
 * is being dragged. A 2px primary-colored line spanning the row width
 * with a small filled caret on the leading edge so the user can see
 * exactly where the new block will land.
 * @returns the rendered drop indicator
 */
function DropIndicator() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative my-1 h-0.5 w-full rounded-full bg-primary">
      <span className="-left-1 -top-[3px] absolute h-2 w-2 rounded-full bg-primary shadow-[0_0_0_2px_var(--color-background)]" />
    </div>
  );
}
