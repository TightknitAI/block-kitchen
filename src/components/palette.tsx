import { useDraggable } from '@dnd-kit/core';
import { ChevronDown, ChevronRight, GripVertical, Search } from 'lucide-react';
import type * as React from 'react';
import { useMemo, useState } from 'react';
import { cn } from '../lib/cn';
import type { PaletteSection as PaletteSectionDef, PaletteVariant } from '../lib/default-blocks';
import { Input } from '../lib/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../lib/ui/tooltip';
import type { PaletteMode, SupportedBlock } from '../types';

/**
 * The DnD draggable id format for palette items, e.g. `palette:section_mrkdwn`.
 * The drop target parses the prefix to know "this is a new block being added"
 * and then resolves the suffix to the appropriate variant factory.
 */
export const PALETTE_DRAG_PREFIX = 'palette:';

/**
 * Checks whether a DnD draggable id refers to a palette item, returning
 * the variant id when it does.
 * @param id - the draggable id from a DnD event
 * @returns the variant id if the drag started in the palette, else null
 */
export function parsePaletteDragId(id: string | number): string | null {
  if (typeof id !== 'string' || !id.startsWith(PALETTE_DRAG_PREFIX)) {
    return null;
  }
  return id.slice(PALETTE_DRAG_PREFIX.length);
}

/**
 * Configuration for which palette sections are open on first paint.
 * - `true` (default) → every section starts open
 * - `false` → every section starts closed
 * - array of section names → only sections whose `name` is in the list start open
 *
 * Matched by `section.name` (case-sensitive) so consumer-defined sections
 * are addressable too — a consumer with custom palette like `[{ name:
 * 'Company presets', ... }]` can pass `['Company presets']` to start that
 * one open.
 */
export type DefaultOpenSections = boolean | readonly string[];

function isDefaultOpen(sectionName: string, config: DefaultOpenSections): boolean {
  if (typeof config === 'boolean') return config;
  return config.includes(sectionName);
}

/**
 * Heading for the rail, shown beside the mode link. Only rendered when the
 * simple/advanced switch is — a palette that opens straight onto its named
 * sections is already self-describing and keeps its untitled header.
 */
const PALETTE_TITLE = 'Message Elements';

/**
 * Copy for the mode link's tooltip. The simple palette is deliberately a
 * dead end — one block, no search — so the link has to say what's behind it.
 */
const ADVANCED_HELP = 'Browse every Slack block type — sections, images, buttons, inputs, tables and more.';

/** Counterpart for the link once the full palette is showing. */
const BASIC_HELP = 'Go back to the short list: just the rich text block for writing a message.';

/**
 * The variants simple mode offers, flattened out of their sections: it's a
 * short starter list, so section headings would be chrome around one row.
 */
function basicVariants(sections: readonly PaletteSectionDef[]): PaletteVariant[] {
  const out: PaletteVariant[] = [];
  for (const section of sections) {
    for (const variant of section.variants) {
      if (variant.basic) {
        out.push(variant);
      }
    }
  }
  return out;
}

function filterSections(sections: readonly PaletteSectionDef[], query: string): readonly PaletteSectionDef[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return sections;
  const out: PaletteSectionDef[] = [];
  for (const section of sections) {
    if (section.name.toLowerCase().includes(q)) {
      out.push(section);
      continue;
    }
    const variants = section.variants.filter((v) => v.label.toLowerCase().includes(q));
    if (variants.length > 0) {
      out.push({ ...section, variants });
    }
  }
  return out;
}

/**
 * The left-side palette of available block variants, organized into
 * collapsible sections that mirror Slack's real Block Kit Builder
 * (Agents, Markdown, Section, Actions, Input, Structure, Rich Text,
 * Image, Card and Carousel, Table). Each variant is a draggable preset
 * that inserts a default-shaped block when dropped on the surface. A
 * search input at the top filters variants by label across all sections;
 * an active query temporarily expands every matching section regardless
 * of its collapsed state.
 *
 * With `mode="simple"` the palette instead opens on a flat list of the
 * variants flagged `basic` — no sections, no search — behind an "Advanced"
 * link that swaps in the full palette described above. That keeps the first
 * screen to the one block most messages are made of, without hiding the
 * rest from anyone who goes looking.
 * @param props - palette props
 * @param props.onAddBlock - called when a palette item is added via its
 *   chevron button (appends the block to the bottom of the preview)
 * @param props.sections - the palette sections to render (the resolved
 *   palette, either the built-in default or a consumer-provided one)
 * @param props.defaultOpenSections - controls which section headers are
 *   expanded on first mount. See {@link DefaultOpenSections}. Defaults to
 *   `true` (all open).
 * @param props.showSearch - whether the quick-search input is rendered
 *   above the section list. Defaults to `true`. Set `false` for compact
 *   palettes where the list is short enough to scan by eye. Simple mode
 *   never shows it, whatever this says.
 * @param props.searchPlaceholder - placeholder text shown in the search
 *   input. Defaults to `'Search blocks…'`. Useful for localization.
 * @param props.mode - `'advanced'` (default) renders the full sectioned
 *   palette straight away. `'simple'` starts on a flat list of the
 *   variants flagged `basic`, with no search and an "Advanced" link at the
 *   top that swaps in the full palette. See {@link PaletteMode}.
 * @param props.defaultAdvanced - which side of that switch the palette
 *   opens on. Defaults to `false` (the simple list).
 * @param props.onAdvancedChange - called with the new side whenever the
 *   user flips the switch.
 * @returns the rendered palette aside
 */
export function Palette({
  onAddBlock,
  sections,
  defaultOpenSections = true,
  showSearch = true,
  searchPlaceholder = 'Search blocks…',
  mode = 'advanced',
  defaultAdvanced = false,
  onAdvancedChange,
  variant = 'aside'
}: {
  onAddBlock: (block: SupportedBlock) => void;
  sections: readonly PaletteSectionDef[];
  defaultOpenSections?: DefaultOpenSections;
  showSearch?: boolean;
  searchPlaceholder?: string;
  mode?: PaletteMode;
  /**
   * Seeds the simple/advanced switch on mount — it isn't a controlled
   * value, so flipping it later doesn't move a palette that's already up.
   * Paired with `onAdvancedChange` it lets a host that unmounts the
   * palette between uses (the mobile sheet closes on every add) hand the
   * user's last choice back on the way in. Ignored by a palette that
   * doesn't offer the switch. Defaults to `false`.
   */
  defaultAdvanced?: boolean;
  /** Called with the newly shown side each time the user flips the switch. */
  onAdvancedChange?: (advanced: boolean) => void;
  /**
   * `'aside'` — persistent left rail (default). Fixed width with right border.
   * `'sheet'` — full-width content for mobile bottom-sheet hosting. No
   *   own borders or width constraints so it fills the sheet body.
   */
  variant?: 'aside' | 'sheet';
}) {
  const [query, setQuery] = useState('');
  // Which side of the simple/advanced switch we're on. Only consulted when
  // the palette offers the switch at all; a mode-less palette is always
  // advanced, so the seed never surfaces there.
  const [advancedOpen, setAdvancedOpen] = useState(defaultAdvanced);

  // A host that flips `mode` at runtime means it: start that mode from the
  // top rather than carrying the old one's expansion (and search) across, or
  // a palette switched back to simple would come up showing everything.
  // Adjusted during render — the alternative effect would paint the stale
  // list first, then correct it.
  const [prevMode, setPrevMode] = useState(mode);
  if (prevMode !== mode) {
    setPrevMode(mode);
    setAdvancedOpen(false);
    setQuery('');
  }

  const basics = useMemo(() => (mode === 'simple' ? basicVariants(sections) : []), [mode, sections]);
  // A simple mode with nothing in it would render an empty rail, so a palette
  // that flags no `basic` variants (a fully custom one, say) stays advanced —
  // the switch is withheld rather than leading somewhere blank.
  const offersSimple = mode === 'simple' && basics.length > 0;
  const advanced = !offersSimple || advancedOpen;

  const searchVisible = showSearch && advanced;
  const visibleSections = useMemo(
    () => (searchVisible ? filterSections(sections, query) : sections),
    [sections, query, searchVisible]
  );
  const queryActive = searchVisible && query.trim().length > 0;
  const isSheet = variant === 'sheet';

  return (
    <aside
      className={cn(
        'flex min-h-0 flex-col overflow-x-hidden overflow-y-auto',
        isSheet ? 'w-full flex-1 bg-background' : 'w-56 shrink-0 border-r bg-muted/20'
      )}
    >
      {offersSimple || searchVisible ? (
        // Two elements so the header is opaque *and* the exact color of the
        // rail. Painted with the rail's own `bg-muted/20`, it composited over
        // the scrolled list instead and headings read through the search box
        // (a `backdrop-blur` softened them, it didn't hide them). Restoring
        // the `bg-background` base under the tint rebuilds the rail's own two
        // layers, so the match holds under any theme.
        <div className="sticky top-0 z-10 shrink-0 bg-background">
          <div className={cn('flex flex-col gap-2 border-b px-3 pt-3 pb-2', isSheet ? 'bg-background' : 'bg-muted/20')}>
            {offersSimple ? (
              // Titled row: with the sections gone, simple mode's header would
              // otherwise be a lone right-aligned link over empty space, and
              // nothing would name what the rail below it holds.
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'min-w-0 truncate font-medium uppercase tracking-wide text-muted-foreground',
                    isSheet ? 'text-xs' : 'text-[11px]'
                  )}
                >
                  {PALETTE_TITLE}
                </span>
                <ModeLink
                  advanced={advanced}
                  isSheet={isSheet}
                  onToggle={() => {
                    // Leaving advanced drops the query with it: it filters a list
                    // that's no longer on screen, and coming back to a palette
                    // pre-filtered by something typed minutes ago reads as a bug.
                    setQuery('');
                    const next = !advancedOpen;
                    setAdvancedOpen(next);
                    onAdvancedChange?.(next);
                  }}
                />
              </div>
            ) : null}
            {searchVisible ? (
              <div className="relative">
                <Search
                  className={cn(
                    'pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground',
                    isSheet ? 'h-4 w-4' : 'h-3.5 w-3.5'
                  )}
                />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className={cn(isSheet ? 'h-10 pl-8 text-base' : 'h-8 pl-7 text-sm')}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={cn('flex flex-col', isSheet ? 'px-2 pb-6' : 'p-3')}>
        {!advanced ? (
          // Simple mode: a flat list, no section headings — with this few
          // rows the headings would outnumber the blocks under them.
          basics.map((v) => <PaletteItem key={v.id} variant={v} onAdd={() => onAddBlock(v.factory())} mode={variant} />)
        ) : visibleSections.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No blocks match.</p>
        ) : (
          visibleSections.map((section) => (
            <PaletteSection
              key={section.name}
              section={section}
              defaultOpen={isDefaultOpen(section.name, defaultOpenSections)}
              forceOpen={queryActive}
              onAddBlock={onAddBlock}
              variant={variant}
            />
          ))
        )}
      </div>
    </aside>
  );
}

/**
 * The simple/advanced switch: a text link in the palette's title row, with
 * the explanation of what's on the other side hung off it as a tooltip
 * (which Radix also wires up as the link's accessible description, so it
 * reaches keyboard and screen-reader users, not just a hovering mouse).
 *
 * Carries its own `TooltipProvider` so the palette works standalone — inside
 * the builder it just nests harmlessly under the one `BlockKitchen` mounts.
 * @param props - link props
 * @param props.advanced - whether the full palette is currently showing
 * @param props.isSheet - whether the palette is rendering in the mobile sheet
 * @param props.onToggle - flips between simple and advanced
 * @returns the rendered mode link
 */
function ModeLink({ advanced, isSheet, onToggle }: { advanced: boolean; isSheet: boolean; onToggle: () => void }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onToggle}
            // Named for what it switches to, not just "Advanced": on its own
            // that word says nothing out of context, and palette variants
            // ("Basic" under Video) are `role="button"` too via dnd-kit, so a
            // bare label wouldn't even be unique. The visible text leads the
            // accessible name, so voice control still matches what's on screen.
            aria-label={advanced ? 'Basic block palette' : 'Advanced block palette'}
            className={cn(
              'shrink-0 cursor-pointer appearance-none rounded border-0 bg-transparent p-0 font-medium text-primary underline underline-offset-2 transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isSheet ? 'min-h-8 text-sm' : 'text-xs'
            )}
          >
            {advanced ? 'Basic' : 'Advanced'}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          {advanced ? BASIC_HELP : ADVANCED_HELP}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * One collapsible category in the palette. Owns its own open/closed
 * state, seeded from `defaultOpen`. When `forceOpen` is true (an active
 * search) it renders expanded regardless of the local state, and the
 * prior state is restored once the search clears.
 */
function PaletteSection({
  section,
  defaultOpen,
  forceOpen,
  onAddBlock,
  variant = 'aside'
}: {
  section: PaletteSectionDef;
  defaultOpen: boolean;
  forceOpen: boolean;
  onAddBlock: (block: SupportedBlock) => void;
  variant?: 'aside' | 'sheet';
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = section.icon;
  const isOpen = open || forceOpen;
  const Caret = isOpen ? ChevronDown : ChevronRight;
  const isSheet = variant === 'sheet';

  return (
    <div className="mt-3 flex flex-col first:mt-0">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex cursor-pointer appearance-none items-center gap-1.5 rounded border-0 bg-transparent text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isSheet ? 'px-2 py-2 min-h-10' : 'px-1 py-1'
        )}
      >
        <Icon className={cn('shrink-0 text-muted-foreground', isSheet ? 'h-5 w-5' : 'h-4 w-4')} />
        <span
          className={cn('min-w-0 flex-1 truncate font-semibold text-foreground', isSheet ? 'text-sm' : 'text-[13px]')}
        >
          {section.name}
        </span>
        <Caret className={cn('shrink-0 text-muted-foreground', isSheet ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
      </button>
      {isOpen ? (
        <div className="mt-0.5 flex flex-col">
          {section.variants.map((v) => (
            <PaletteItem key={v.id} variant={v} onAdd={() => onAddBlock(v.factory())} mode={variant} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One draggable palette row. Hover surfaces a chevron button that
 * appends the variant's block to the preview without dragging.
 * @param props - item props
 * @param props.variant - the block variant this row represents
 * @param props.onAdd - called when the chevron button is clicked
 * @returns the rendered palette row
 */
function PaletteItem({
  variant,
  onAdd,
  mode = 'aside'
}: {
  variant: PaletteVariant;
  onAdd: () => void;
  mode?: 'aside' | 'sheet';
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_DRAG_PREFIX}${variant.id}`
  });

  const isSheet = mode === 'sheet';

  if (isSheet) {
    // In the mobile sheet the row IS the tap target — no separate grip /
    // chevron split. Touch DnD is unreliable on mixed scrollers anyway, so
    // we lean on tap-to-add as the primary input here.
    return (
      <button
        ref={setNodeRef as unknown as React.Ref<HTMLButtonElement>}
        type="button"
        aria-label={`Add ${variant.label}`}
        onClick={onAdd}
        className={cn(
          'group flex w-full min-h-11 cursor-pointer items-center gap-3 rounded-md border border-transparent bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-border hover:bg-accent active:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isDragging && 'opacity-50'
        )}
      >
        <span className="min-w-0 flex-1 truncate">{variant.label}</span>
        {/* Trailing, the way a nav row's disclosure chevron reads: the label
          is what the eye scans down, and the chevron marks where the row
          takes you. */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <ChevronRight className="h-4 w-4" />
        </span>
      </button>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group flex items-center gap-2 rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground has-[:focus-visible]:bg-accent has-[:focus-visible]:text-foreground',
        isDragging && 'opacity-50'
      )}
    >
      <div
        ref={setActivatorNodeRef}
        // Negative margin plus matching padding so the grab target still
        // covers the row's full height after the row itself tightened up.
        className="-my-1 flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded py-1 active:cursor-grabbing focus-visible:outline-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{variant.label}</span>
      </div>
      <button
        type="button"
        aria-label={`Add ${variant.label} to preview`}
        onClick={onAdd}
        className="ml-auto flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-transparent text-muted-foreground opacity-0 transition-opacity hover:border-border hover:bg-background hover:text-foreground group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
