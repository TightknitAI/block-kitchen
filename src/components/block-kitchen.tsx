import {
  type CollisionDetection,
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { type KeyboardEvent, useCallback, useMemo, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { parseContainerBodyId } from '../lib/container-blocks';
import { makeEmojiHook } from '../lib/custom-emoji-hook';
import { buildVariantById, defaultPalette, type PaletteSection } from '../lib/default-blocks';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../lib/ui/sheet';
import { TooltipProvider } from '../lib/ui/tooltip';
import { useIsMobile } from '../lib/use-is-mobile';
import { CustomEmojiProvider } from '../state/custom-emoji-context';
import { useBlockKitValidation } from '../state/use-block-kit-validation';
import { type MoveTarget, useBlockKitchenState } from '../state/use-block-kitchen-state';
import { useDevWarning } from '../state/use-dev-warning';
import { useNotifyOnChange } from '../state/use-notify-on-change';
import type {
  BlockKitchenBaseProps,
  BlockKitchenComposeOnlyProps,
  BlockKitchenProps,
  BlockKitchenSendProps,
  LoadedMessage,
  LoadResult,
  PreviewSurface,
  PreviewTheme,
  ValidationSummary
} from '../types';
import { BrandThemeScope } from './brand-theme-scope';
import { IssuesSheet } from './issues-sheet';
import { JsonDrawer } from './json-drawer';
import { LoadMessageDialog } from './load-message-dialog';
import { Palette, parsePaletteDragId } from './palette';
import { SendDialog } from './send-dialog';
import { SURFACE_DROPPABLE_ID, Surface } from './surface';
import { Toolbar } from './toolbar';
import { UpdateDialog } from './update-dialog';

/**
 * Normalize a load verdict / pre-loaded target down to the public
 * {@link LoadedMessage} shape, dropping the load-result extras (`ok`,
 * `blocks`) so host-facing surfaces (`onLoadedMessageChange`,
 * `primaryAction` context) carry a clean contract. The ok-branch is defined
 * as `LoadedMessage & { ok; blocks }`, so the rest after removing those two
 * IS the loaded message — new fields flow through without touching this.
 */
function toLoadedMessage({
  ok: _ok,
  blocks: _blocks,
  ...loadedMessage
}: Extract<LoadResult, { ok: true }>): LoadedMessage {
  return loadedMessage;
}

/** Serializes a loaded message for change-notification dedupe (by value, so any field change re-notifies). */
function loadedMessageKey(message: LoadedMessage | null): string | null {
  return message ? JSON.stringify(message) : null;
}

/** Serializes a validation summary for change-notification dedupe. */
function validationSummaryKey(summary: ValidationSummary): string {
  return JSON.stringify([summary.valid, summary.errorCount, ...summary.errors]);
}

/**
 * Top-level Slack Block Kit builder component.
 * Renders the toolbar, palette, preview surface, popover editors, send
 * dialog, and View-JSON drawer. Integration-agnostic: all I/O is brokered
 * through props.
 * @param props - {@link BlockKitchenProps}
 * @returns the rendered Block Kit Builder
 */
export function BlockKitchen(props: BlockKitchenProps) {
  const {
    workspaceName,
    initialBlocks,
    onChange,
    onValidationChange,
    previewHooks,
    customEmojis,
    loadChannels,
    loadSendAsUserStatus,
    onSend,
    renderSendExtras,
    loading,
    onUpdate: onUpdateProp,
    primaryAction,
    loadButtonLabel,
    updateButtonLabel,
    confirmUpdateLabel,
    palette,
    disabledBlockTypes,
    paletteMode,
    showPaletteSearch,
    paletteSearchPlaceholder,
    defaultOpenSections,
    allowedSurfaces: allowedSurfacesProp,
    showThemeControl = true,
    docsLink,
    defaultPreviewTheme = 'light',
    previewTheme: controlledPreviewTheme,
    sendButtonLabel,
    confirmSendLabel,
    theme
    // Widen the all-or-nothing union so the branch-specific props
    // destructure as independent optionals: untyped JS consumers can still
    // pass partial wiring (handled by the runtime guards below), and the
    // correlated-union narrowing would otherwise flag those guards as
    // "always true". `primaryAction` is pulled from the compose-only branch
    // (where it carries a real type) rather than the send branch's
    // `undefined` pin, which would collapse the intersection to `undefined`.
  } = props as BlockKitchenBaseProps &
    Partial<Omit<BlockKitchenSendProps, 'primaryAction'>> &
    Pick<BlockKitchenComposeOnlyProps, 'primaryAction'>;

  const paletteSections = useMemo(() => {
    const sections = palette ?? defaultPalette;
    if (!disabledBlockTypes || disabledBlockTypes.length === 0) {
      return sections;
    }
    // Filter at the variant level: a section may mix block types (e.g.
    // Structure contains divider + header + context), so dropping a
    // whole section by name would over-prune. Run each factory once to
    // peek at the block type; drop sections that end up empty.
    const blocked = new Set(disabledBlockTypes);
    const filtered: PaletteSection[] = [];
    for (const section of sections) {
      const variants = section.variants.filter((variant) => !blocked.has(variant.factory().type));
      if (variants.length > 0) {
        filtered.push({ ...section, variants });
      }
    }
    return filtered;
  }, [palette, disabledBlockTypes]);
  const variantById = useMemo(() => buildVariantById(paletteSections), [paletteSections]);

  // Default to message-only when omitted (or passed empty). The toolbar
  // needs at least one entry to seed `previewSurface`; it hides the
  // dropdown when this resolves to a single surface.
  const allowedSurfaces: readonly PreviewSurface[] =
    allowedSurfacesProp && allowedSurfacesProp.length > 0 ? allowedSurfacesProp : ['message'];

  // Compose-only mode: the send trio is all-or-nothing (enforced at the type
  // level by `BlockKitchenProps`). When absent, the toolbar renders no send
  // button and the send/update dialogs never mount — the builder is a pure
  // editor and the host owns the send flow via `onChange` +
  // `onValidationChange`.
  const sendEnabled = Boolean(loadChannels && loadSendAsUserStatus && onSend);

  // Loading an existing message is a *composition* concern, so it works in
  // both modes — `loading` lives on the base props, independent of the trio.
  const loadEnabled = Boolean(loading);
  // The recent-messages picker needs a channel list to scope its lookup:
  // `loading.loadChannels` when given, else the send integration's. With
  // neither, the picker is withheld and only the paste-link entry renders.
  const recentChannelSource = loading?.loadChannels ?? (sendEnabled ? loadChannels : undefined);

  // Updating in place is a *distribution* concern (`chat.update` is bound to
  // a channel + timestamp + token), so it only exists with the send
  // integration wired.
  const onUpdate = sendEnabled ? onUpdateProp : undefined;

  // A pre-loaded target (opt-in) carries its own blocks; they seed the
  // draft and win over `initialBlocks`, which is the blank-canvas seed.
  const seededBlocks = loading?.initialTarget?.blocks ?? initialBlocks;

  // Dev-time wiring warnings. Evaluated on every render (props can change
  // mid-session — the demo toggles `loading`/`onUpdate` live), each fires at
  // most once per mounted instance.
  const sendPropsProvided = [loadChannels, loadSendAsUserStatus, onSend].filter(Boolean).length;
  useDevWarning(
    Boolean(loading?.initialTarget && initialBlocks),
    '[BlockKitchen] Both `initialBlocks` and an `initialTarget` were provided; ' +
      'using the target’s blocks and ignoring `initialBlocks`.'
  );
  useDevWarning(
    sendPropsProvided > 0 && sendPropsProvided < 3,
    '[BlockKitchen] Partial send wiring: `loadChannels`, `loadSendAsUserStatus`, and `onSend` ' +
      'are all-or-nothing. The send button is hidden until all three are provided.'
  );
  useDevWarning(
    Boolean(onUpdateProp && !sendEnabled),
    '[BlockKitchen] `onUpdate` requires the send integration (`loadChannels`, ' +
      '`loadSendAsUserStatus`, `onSend`); ignoring `onUpdate`. To load an existing message ' +
      'without the send integration, use the `loading` prop instead.'
  );
  useDevWarning(
    Boolean(sendEnabled && onUpdateProp && !loading),
    '[BlockKitchen] `onUpdate` needs a loaded message, but no load source is ' +
      'configured — provide the `loading` prop. The update flow is unreachable.'
  );
  useDevWarning(
    Boolean(loading?.loadRecentMessages && !recentChannelSource),
    '[BlockKitchen] `loading.loadRecentMessages` needs a channel list to scope its lookup — ' +
      'provide `loading.loadChannels` (compose-only mode has no send integration to reuse). ' +
      'Hiding the recent-messages picker.'
  );
  useDevWarning(
    Boolean(renderSendExtras && !sendEnabled),
    '[BlockKitchen] `renderSendExtras` extends the built-in send dialog, which requires the ' +
      'send integration (`loadChannels`, `loadSendAsUserStatus`, `onSend`); ignoring `renderSendExtras`.'
  );
  useDevWarning(
    Boolean(primaryAction && sendEnabled),
    '[BlockKitchen] `primaryAction` is only available in compose-only mode — with the send ' +
      'integration wired, the built-in Send/Update flow owns the toolbar’s primary action; ' +
      'ignoring `primaryAction`.'
  );

  const {
    blocks,
    addBlock,
    addChild,
    updateBlock,
    removeBlock,
    duplicateBlock,
    reorderBlock,
    moveBlock,
    replaceAll,
    resetAll,
    undo,
    redo,
    canUndo,
    canRedo
  } = useBlockKitchenState({ initialBlocks: seededBlocks, onChange });

  // Lookups for resolving a drop target: which ids are container children,
  // and which container each child belongs to. Recomputed when the tree
  // changes; read by collision detection and the drag-end handler.
  const childParentById = useMemo(() => {
    const map = new Map<string, string>();
    for (const top of blocks) {
      if (top.children) {
        for (const child of top.children) {
          map.set(child.id, top.id);
        }
      }
    }
    return map;
  }, [blocks]);

  const [jsonOpen, setJsonOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  // Loading (opt-in via `loading`). `editTarget` is the loaded message;
  // when set, send mode's split button can update it in place
  // (`updateOpen`) or post the current blocks as new (`sendOpen`), and
  // compose-only hosts receive it via `primaryAction` context /
  // `onLoadedMessageChange`.
  const [updateOpen, setUpdateOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LoadedMessage | null>(() =>
    loading?.initialTarget ? toLoadedMessage(loading.initialTarget) : null
  );
  // A loaded message only counts as active while loading is configured. If
  // the host toggles the config off mid-session, fall back to plain
  // composing without losing the target (it reactivates if it returns).
  const activeEditTarget = loadEnabled ? editTarget : null;

  // Report loaded-message changes to the host — compose-only hosts keep
  // their own commitment step in sync this way. Value-keyed, so re-loading
  // the same message with a changed verdict (e.g. `editableVia` flipping
  // after sign-in) re-notifies; notifications only flow while `loading` is
  // configured.
  useNotifyOnChange(activeEditTarget, loadedMessageKey, loading?.onLoadedMessageChange);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Desktop only: the rail is hidden (not unmounted) while collapsed, and
  // the handle on its edge brings it back. Mobile has no rail to collapse —
  // the palette is the sheet `paletteOpen` above governs.
  const [paletteCollapsed, setPaletteCollapsed] = useState(false);
  // Which side of the palette's simple/advanced switch the user last chose.
  // The rail keeps its own state while it's up, but the mobile sheet is torn
  // down on every close, so without a memory out here every re-open would
  // land back on the basic list.
  const [paletteAdvanced, setPaletteAdvanced] = useState(false);
  // A host that flips `paletteMode` mid-session starts the new mode from the
  // top (the palette does the same internally), so the remembered side goes
  // with it. Adjusted during render rather than in an effect, which would
  // hand the stale choice to a sheet opened in between.
  const [prevPaletteMode, setPrevPaletteMode] = useState(paletteMode);
  if (prevPaletteMode !== paletteMode) {
    setPrevPaletteMode(paletteMode);
    setPaletteAdvanced(false);
  }
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);
  // Preview theme is controlled when the host passes `previewTheme`, and
  // uncontrolled (seeded from `defaultPreviewTheme`) otherwise. The
  // uncontrolled state is only mutated by the toolbar toggle, which is
  // hidden whenever the theme is controlled — so the two never fight.
  const [uncontrolledPreviewTheme, setUncontrolledPreviewTheme] = useState<PreviewTheme>(defaultPreviewTheme);
  const isPreviewThemeControlled = controlledPreviewTheme !== undefined;
  const previewTheme = controlledPreviewTheme ?? uncontrolledPreviewTheme;
  const [previewSurface, setPreviewSurface] = useState<PreviewSurface>(allowedSurfaces[0]);
  const [activePaletteVariantId, setActivePaletteVariantId] = useState<string | null>(null);
  // The mobile palette sheet's own element, so opening it can land focus
  // there instead of on the first control the palette happens to render.
  const paletteSheetRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();

  // Merge a custom-emoji `emoji` hook into the caller's preview hooks so the
  // preview renders `:custom:` as the workspace image (and resolves aliases).
  // An explicit caller-supplied `emoji` hook wins over ours. When no custom
  // emoji are provided we forward `previewHooks` untouched so behavior is
  // identical to before the prop existed.
  const mergedPreviewHooks = useMemo(() => {
    if (!customEmojis || customEmojis.length === 0) {
      return previewHooks;
    }
    const byName = new Map(customEmojis.map((emoji) => [emoji.name, emoji] as const));
    return { emoji: makeEmojiHook(byName), ...previewHooks };
  }, [customEmojis, previewHooks]);

  // Always validate against the `message` surface: that's where Send posts
  // to. If we scoped validation to the preview surface, a user could switch
  // to `modal`, drop in modal-only blocks, see `errorCount === 0`, and have
  // Send accept a payload Slack will reject.
  const validation = useBlockKitValidation(blocks, 'message');

  // The host-facing snapshot of the verdict: what `onValidationChange`
  // reports and what a compose-only `primaryAction` click receives.
  const validationSummary = useMemo<ValidationSummary>(
    () => ({ valid: validation.valid, errorCount: validation.total, errors: validation.errors }),
    [validation]
  );

  // Report the verdict to the host only when it actually changes: the
  // validation hook re-runs (with a fresh object identity) on every
  // debounced pass, and the callback prop is often an inline arrow, so both
  // are deduped against the last-notified key rather than used as change
  // signals themselves.
  useNotifyOnChange(validationSummary, validationSummaryKey, onValidationChange);

  // Touch needs a 150ms press-and-hold to start a drag so scrolling the
  // surface doesn't accidentally pick up a block. Pointer keeps the small
  // 4px distance threshold so mouse clicks still open the editor cleanly.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Pick the block directly under the cursor when possible so the drop
  // target tracks the cursor rather than whichever droppable's geometric
  // center is nearest. The surface (a tall droppable) used to win against
  // small block rows under closestCenter, which made it look like every
  // palette drop appended to the end. Fall back to closestCenter so the
  // bottom of the surface still resolves to a valid target when the
  // cursor sits past the last block.
  // Prefer the most specific drop target under the cursor so nested
  // container drop zones win over the surface they sit inside: a child row
  // beats the container body, the body beats the container's own row, and
  // any block beats the tall surface droppable.
  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const hits = pointerWithin(args);
      if (hits.length > 0) {
        const child = hits.find((c) => childParentById.has(c.id as string));
        if (child) return [child];
        const body = hits.find((c) => parseContainerBodyId(c.id) !== null);
        if (body) return [body];
        const block = hits.find((c) => c.id !== SURFACE_DROPPABLE_ID && parseContainerBodyId(c.id) === null);
        if (block) return [block];
        return hits;
      }
      return closestCenter(args);
    },
    [childParentById]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const variantId = parsePaletteDragId(event.active.id);
    setActivePaletteVariantId(variantId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePaletteVariantId(null);
      const { active, over } = event;
      if (!over) {
        return;
      }
      const overId = over.id as string;

      // Resolve the `over` droppable into a destination list + index:
      // the surface end, a slot among the top-level blocks, a container's
      // body (append), or a slot among a container's children (the hovered
      // child's index).
      let target: MoveTarget | null;
      const bodyParent = parseContainerBodyId(overId);
      const childParent = childParentById.get(overId);
      if (overId === SURFACE_DROPPABLE_ID) {
        target = { kind: 'top', index: blocks.length };
      } else if (bodyParent) {
        const count = blocks.find((b) => b.id === bodyParent)?.children?.length ?? 0;
        target = { kind: 'container', parentId: bodyParent, index: count };
      } else if (childParent) {
        const siblings = blocks.find((b) => b.id === childParent)?.children ?? [];
        target = { kind: 'container', parentId: childParent, index: siblings.findIndex((c) => c.id === overId) };
      } else {
        const topIndex = blocks.findIndex((b) => b.id === overId);
        target = topIndex === -1 ? null : { kind: 'top', index: topIndex };
      }
      if (!target) {
        return;
      }

      const variantId = parsePaletteDragId(active.id);
      if (variantId) {
        const variant = variantById.get(variantId);
        if (!variant) {
          return;
        }
        if (target.kind === 'container') {
          addChild(target.parentId, variant.factory(), target.index);
        } else {
          addBlock(variant.factory(), target.index);
        }
        return;
      }

      if (active.id !== overId) {
        moveBlock(active.id as string, target);
      }
    },
    [addBlock, addChild, blocks, childParentById, moveBlock, variantById]
  );

  const handleDragCancel = useCallback(() => {
    setActivePaletteVariantId(null);
  }, []);

  // Undo/redo keyboard shortcuts, scoped to the builder: this is a React
  // `onKeyDown` on the root, so it only fires while focus is inside the
  // builder and never hijacks the host app's own Cmd+Z. Text-editing targets
  // (inputs, textareas, the inline rich-text contentEditable) keep their
  // native per-character undo — we bail before preventing default. Popover
  // and dialog editors render in body-level portals outside this subtree, so
  // their fields are unaffected regardless.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = key === 'y' || (key === 'z' && event.shiftKey);
      if (!isUndo && !isRedo) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
        return;
      }
      event.preventDefault();
      if (isRedo) {
        if (canRedo) redo();
      } else if (canUndo) {
        undo();
      }
    },
    [canRedo, canUndo, redo, undo]
  );

  const activePaletteVariant = activePaletteVariantId ? variantById.get(activePaletteVariantId) : null;

  const blockPayloads = blocks.map((b) => b.block);

  return (
    <BrandThemeScope theme={theme}>
      <CustomEmojiProvider customEmojis={customEmojis}>
        <TooltipProvider delayDuration={200}>
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {/* The builder shell doubles as the keydown scope for undo/redo
              shortcuts: the handler only augments already-focusable children
              (toolbar buttons, block rows, fields) and never acts as a
              control itself, so it needs no role or tabindex.

              `h-full` computes to `auto` in ordinary document flow, so the
              shell grew to its tallest child — the palette — instead of
              scrolling it. The `max-h` bounds that case and stays inert when
              the host's own height is smaller. Override with
              `--bk-max-height` on any ancestor (`none` opts out). */}
            <div
              className="bk-root flex h-full max-h-[var(--bk-max-height,100svh)] w-full flex-col overflow-hidden rounded-md border bg-background text-foreground"
              onKeyDown={handleKeyDown}
            >
              <Toolbar
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                onClear={() => replaceAll([])}
                onOpenJson={() => setJsonOpen(true)}
                onOpenIssues={() => setIssuesOpen(true)}
                onOpenSend={() => setSendOpen(true)}
                onOpenPalette={() => setPaletteOpen(true)}
                canSend={blocks.length > 0}
                canClear={blocks.length > 0}
                errorCount={validation.total}
                previewTheme={previewTheme}
                onPreviewThemeChange={setUncontrolledPreviewTheme}
                previewSurface={previewSurface}
                onPreviewSurfaceChange={setPreviewSurface}
                allowedSurfaces={allowedSurfaces}
                // A controlled `previewTheme` always hides the toggle so the
                // host app fully owns the theme; otherwise honor the prop.
                showThemeControl={isPreviewThemeControlled ? false : showThemeControl}
                docsLink={docsLink}
                showSend={sendEnabled}
                // Compose-only mode only: with the send integration wired,
                // the built-in Send/Update flow owns the primary slot (and a
                // mount-time warning covers untyped consumers passing both).
                primaryAction={
                  !sendEnabled && primaryAction
                    ? {
                        label: primaryAction.label,
                        onClick: () =>
                          primaryAction.onClick({
                            blocks: blockPayloads,
                            validation: validationSummary,
                            loadedMessage: activeEditTarget
                          }),
                        disabled: primaryAction.disableWhenInvalid ? !validationSummary.valid : false
                      }
                    : null
                }
                sendButtonLabel={sendButtonLabel}
                loadEnabled={loadEnabled}
                updateEnabled={Boolean(onUpdate)}
                editBadge={
                  activeEditTarget
                    ? {
                        channelLabel: activeEditTarget.channelName
                          ? `#${activeEditTarget.channelName}`
                          : activeEditTarget.channelId,
                        ts: activeEditTarget.ts
                      }
                    : null
                }
                onOpenLoad={() => setLoadOpen(true)}
                onOpenUpdate={() => setUpdateOpen(true)}
                onExitEdit={() => {
                  if (sendEnabled) {
                    // Edit-centric exit (send mode): discard the loaded
                    // message's draft and reopen the loader so the user
                    // starts fresh or picks another message. Reset (not
                    // replace) so undo can't resurrect the abandoned draft
                    // after the banner is gone.
                    setEditTarget(null);
                    resetAll([]);
                    setLoadOpen(true);
                    return;
                  }
                  // Compose-only exit: loading seeded a composition the user
                  // may have kept editing, so detach the reference but keep
                  // the draft — a misclick must not destroy ten minutes of
                  // work, and there's no built-in flow to hand off to. The
                  // host hears about the detach via onLoadedMessageChange.
                  setEditTarget(null);
                }}
                loadButtonLabel={loadButtonLabel}
                updateButtonLabel={updateButtonLabel}
              />
              <div className="flex min-h-0 flex-1 items-stretch">
                {/* Desktop: persistent left aside, collapsed by the handle on
                  its own edge. Mobile: no rail at all — the palette is the
                  sheet the toolbar's Blocks button opens. Collapsing hides
                  the rail rather than unmounting it, so it comes back with
                  its open sections and search exactly as they were left. */}
                <div className="relative hidden min-h-0 shrink-0 md:flex">
                  <div hidden={paletteCollapsed} className={cn('min-h-0', !paletteCollapsed && 'flex')}>
                    <Palette
                      onAddBlock={(block) => addBlock(block)}
                      sections={paletteSections}
                      mode={paletteMode}
                      showSearch={showPaletteSearch}
                      searchPlaceholder={paletteSearchPlaceholder}
                      defaultOpenSections={defaultOpenSections}
                      defaultAdvanced={paletteAdvanced}
                      onAdvancedChange={setPaletteAdvanced}
                    />
                  </div>
                  {paletteCollapsed ? (
                    // In a host that hands the builder no height of its own,
                    // the rail is what the shell takes its height from (see
                    // the shell's `max-h` note above) — so hiding it would
                    // shrink the whole frame to the height of the message and
                    // grow it back on the way out. This stands in for the rail
                    // at no width. Inert to everything but layout.
                    <div aria-hidden className="w-0 shrink-0 md:h-[var(--bk-max-height,100svh)]" />
                  ) : null}
                  {/* The collapse handle rides the rail's own edge, half over
                    the border, rather than sitting in the toolbar away from
                    what it acts on. With the rail hidden the column has no
                    width, so the handle tucks against the shell's left edge
                    instead of hanging half outside it. */}
                  <button
                    type="button"
                    onClick={() => setPaletteCollapsed((v) => !v)}
                    aria-expanded={!paletteCollapsed}
                    aria-label={paletteCollapsed ? 'Show block palette' : 'Hide block palette'}
                    title={paletteCollapsed ? 'Show block palette' : 'Hide block palette'}
                    className={cn(
                      // No border or shadow of its own: the chevron sits on
                      // the rail's border, and its own background is what
                      // breaks the line cleanly behind it.
                      'absolute top-1/2 z-10 flex h-10 w-4 -translate-y-1/2 cursor-pointer appearance-none items-center justify-center rounded-sm border-0 bg-background p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      paletteCollapsed ? 'left-0' : 'right-0 translate-x-1/2'
                    )}
                  >
                    {paletteCollapsed ? (
                      <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                    ) : (
                      <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
                <Surface
                  blocks={blocks}
                  workspaceName={workspaceName}
                  // When a message is loaded for editing, show its author in
                  // the preview header instead of the generic workspace name.
                  authorName={activeEditTarget?.username}
                  authorIcon={activeEditTarget?.iconUrl}
                  previewHooks={mergedPreviewHooks}
                  previewTheme={previewTheme}
                  previewSurface={previewSurface}
                  errorsByBlockId={validation.byBlockId}
                  openBlockId={openBlockId}
                  onOpenBlockChange={setOpenBlockId}
                  onUpdate={updateBlock}
                  onDuplicate={duplicateBlock}
                  onDelete={removeBlock}
                  onReorder={reorderBlock}
                  isPaletteDrag={activePaletteVariant !== null}
                  onOpenPalette={() => setPaletteOpen(true)}
                />
              </div>
            </div>
            <DragOverlay dropAnimation={null}>
              {activePaletteVariant ? (
                <div className="flex items-center gap-1.5 rounded border bg-background px-1.5 py-1 text-xs text-foreground shadow-md">
                  <GripVertical className="h-3 w-3 shrink-0" />
                  <span className="truncate">{activePaletteVariant.label}</span>
                </div>
              ) : null}
            </DragOverlay>
            {/* Mobile-only palette sheet. The desktop aside above stays put;
              this opens from the bottom on a tap of the toolbar's Blocks
              button. Tap-to-add closes the sheet so the user sees the new
              row land in the surface. */}
            <Sheet open={paletteOpen && isMobile} onOpenChange={setPaletteOpen}>
              <SheetContent
                ref={paletteSheetRef}
                side="bottom"
                className="bk-portal-content flex h-[85svh] max-h-[85svh] flex-col gap-3 p-0 sm:max-w-none"
                // Radix moves focus to the first tabbable node on open, which
                // here is whatever the palette leads with — the Advanced link
                // (whose tooltip then pops unbidden) or the search box (which
                // raises the on-screen keyboard over the list the user came to
                // read). Neither is what a tap on "Blocks" asked for, so focus
                // the sheet itself: the trap, Escape and the reading order all
                // still start at the top of the sheet.
                onOpenAutoFocus={(e) => {
                  e.preventDefault();
                  paletteSheetRef.current?.focus();
                }}
              >
                <div className="flex flex-col gap-1 px-4 pt-5">
                  <SheetTitle>Add a block</SheetTitle>
                  <SheetDescription>Tap a block to add it to the bottom of your draft.</SheetDescription>
                </div>
                <div className="flex min-h-0 flex-1 flex-col">
                  <Palette
                    onAddBlock={(block) => {
                      addBlock(block);
                      setPaletteOpen(false);
                    }}
                    sections={paletteSections}
                    mode={paletteMode}
                    showSearch={showPaletteSearch}
                    searchPlaceholder={paletteSearchPlaceholder}
                    defaultOpenSections={defaultOpenSections}
                    defaultAdvanced={paletteAdvanced}
                    onAdvancedChange={setPaletteAdvanced}
                    variant="sheet"
                  />
                </div>
              </SheetContent>
            </Sheet>
            <JsonDrawer open={jsonOpen} onOpenChange={setJsonOpen} blocks={blockPayloads} onApply={replaceAll} />
            {/* The Send dialog always posts a brand-new message (used by both
              plain Send and the edit-mode "Send as a new message"). The Update
              dialog (channel locked) only exists while a message is loaded
              and update-in-place is wired. Neither mounts in compose-only
              mode; the Load dialog below mounts whenever loading is
              configured — loading is a composition concern, mode-agnostic. */}
            {loadChannels && loadSendAsUserStatus && onSend ? (
              <SendDialog
                open={sendOpen}
                onOpenChange={setSendOpen}
                blocks={blockPayloads}
                loadChannels={loadChannels}
                loadSendAsUserStatus={loadSendAsUserStatus}
                onSend={onSend}
                renderSendExtras={renderSendExtras}
                confirmSendLabel={confirmSendLabel}
                errorCount={validation.total}
                onShowIssues={() => {
                  setSendOpen(false);
                  setIssuesOpen(true);
                }}
              />
            ) : null}
            {activeEditTarget && onUpdate && loadSendAsUserStatus ? (
              <UpdateDialog
                open={updateOpen}
                onOpenChange={setUpdateOpen}
                target={activeEditTarget}
                blocks={blockPayloads}
                loadSendAsUserStatus={loadSendAsUserStatus}
                onUpdate={onUpdate}
                confirmUpdateLabel={confirmUpdateLabel}
                errorCount={validation.total}
                onShowIssues={() => {
                  setUpdateOpen(false);
                  setIssuesOpen(true);
                }}
              />
            ) : null}
            {loading ? (
              <LoadMessageDialog
                open={loadOpen}
                onOpenChange={setLoadOpen}
                onLoadMessage={loading.onLoadMessage}
                // The dialog owns the picker-visibility rule (it renders the
                // recent picker only when both loaders are present); this
                // component's job is just resolving the channel source.
                loadRecentMessages={loading.loadRecentMessages}
                loadChannels={recentChannelSource}
                // The dialog's preview pane renders through the same pipeline
                // as the builder's surface, so a message looks the same before
                // and after it loads (custom emoji ride along in the merged
                // hooks).
                previewHooks={mergedPreviewHooks}
                previewTheme={previewTheme}
                onLoaded={(result) => {
                  // A newly loaded message is a fresh document: reset history
                  // so undo starts from the loaded blocks and can't step back
                  // across the load into the previous draft.
                  resetAll(result.blocks);
                  setEditTarget(toLoadedMessage(result));
                  setLoadOpen(false);
                }}
                onOpenAsNew={(loadedBlocks) => {
                  // Fallback for a not-editable verdict: drop edit mode and
                  // hydrate the draft (when the host supplied blocks) so the
                  // user can repost it as a brand-new message. Fresh document,
                  // so reset history here too.
                  if (loadedBlocks) {
                    resetAll(loadedBlocks);
                  }
                  setEditTarget(null);
                  setLoadOpen(false);
                }}
              />
            ) : null}
            <IssuesSheet
              open={issuesOpen}
              onOpenChange={setIssuesOpen}
              blocks={blocks}
              validation={validation}
              onJumpToBlock={(id) => setOpenBlockId(id)}
            />
          </DndContext>
        </TooltipProvider>
      </CustomEmojiProvider>
    </BrandThemeScope>
  );
}
