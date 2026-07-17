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
import { GripVertical } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseContainerBodyId } from '../lib/container-blocks';
import { makeEmojiHook } from '../lib/custom-emoji-hook';
import { buildVariantById, defaultPalette, type PaletteSection } from '../lib/default-blocks';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../lib/ui/sheet';
import { TooltipProvider } from '../lib/ui/tooltip';
import { useIsMobile } from '../lib/use-is-mobile';
import { CustomEmojiProvider } from '../state/custom-emoji-context';
import { useBlockKitValidation } from '../state/use-block-kit-validation';
import { type MoveTarget, useBlockKitchenState } from '../state/use-block-kitchen-state';
import type {
  BlockKitchenBaseProps,
  BlockKitchenComposeOnlyProps,
  BlockKitchenProps,
  BlockKitchenSendProps,
  LoadedMessage,
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
 * {@link LoadedMessage} shape, dropping load-result extras (`ok`, `blocks`)
 * so host-facing surfaces (`onLoadedMessageChange`, `primaryAction` context)
 * carry a clean contract.
 */
function toLoadedMessage(target: LoadedMessage & { ok?: boolean; blocks?: unknown }): LoadedMessage {
  return {
    channelId: target.channelId,
    channelName: target.channelName,
    ts: target.ts,
    editableVia: target.editableVia,
    workspaceName: target.workspaceName,
    username: target.username,
    iconUrl: target.iconUrl
  };
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
    editing,
    primaryAction,
    loadButtonLabel,
    updateButtonLabel,
    confirmUpdateLabel,
    palette,
    disabledBlockTypes,
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
  const onUpdate = sendEnabled ? editing?.onUpdate : undefined;

  // A pre-loaded target (opt-in) carries its own blocks; they seed the
  // draft and win over `initialBlocks`, which is the blank-canvas seed.
  const seededBlocks = loading?.initialTarget?.blocks ?? initialBlocks;
  // Mount-only: these props are read once at mount, so warn once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only check
  useEffect(() => {
    if (loading?.initialTarget && initialBlocks) {
      console.warn(
        '[BlockKitchen] Both `initialBlocks` and an `initialTarget` were provided; ' +
          'using the target’s blocks and ignoring `initialBlocks`.'
      );
    }
    const sendPropsProvided = [loadChannels, loadSendAsUserStatus, onSend].filter(Boolean).length;
    if (sendPropsProvided > 0 && sendPropsProvided < 3) {
      console.warn(
        '[BlockKitchen] Partial send wiring: `loadChannels`, `loadSendAsUserStatus`, and `onSend` ' +
          'are all-or-nothing. The send button is hidden until all three are provided.'
      );
    }
    if (editing && !sendEnabled) {
      console.warn(
        '[BlockKitchen] `editing` requires the send integration (`loadChannels`, ' +
          '`loadSendAsUserStatus`, `onSend`); ignoring `editing`. To load an existing message ' +
          'without the send integration, use the `loading` prop instead.'
      );
    }
    if (sendEnabled && editing && !loading) {
      console.warn(
        '[BlockKitchen] `editing.onUpdate` needs a loaded message, but no load source is ' +
          'configured — provide the `loading` prop. The update flow is unreachable.'
      );
    }
    if (loading?.loadRecentMessages && !recentChannelSource) {
      console.warn(
        '[BlockKitchen] `loading.loadRecentMessages` needs a channel list to scope its lookup — ' +
          'provide `loading.loadChannels` (compose-only mode has no send integration to reuse). ' +
          'Hiding the recent-messages picker.'
      );
    }
    if (renderSendExtras && !sendEnabled) {
      console.warn(
        '[BlockKitchen] `renderSendExtras` extends the built-in send dialog, which requires the ' +
          'send integration (`loadChannels`, `loadSendAsUserStatus`, `onSend`); ignoring `renderSendExtras`.'
      );
    }
    if (primaryAction && sendEnabled) {
      console.warn(
        '[BlockKitchen] `primaryAction` is only available in compose-only mode — with the send ' +
          'integration wired, the built-in Send/Update flow owns the toolbar’s primary action; ' +
          'ignoring `primaryAction`.'
      );
    }
  }, []);

  const { blocks, addBlock, addChild, updateBlock, removeBlock, duplicateBlock, reorderBlock, moveBlock, replaceAll } =
    useBlockKitchenState({ initialBlocks: seededBlocks, onChange });

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
  // their own commitment step in sync this way. Deduped by channel + ts so
  // re-renders don't re-fire; the callback lives in a ref since consumers
  // often pass a fresh object/arrow each render.
  const onLoadedMessageChangeRef = useRef(loading?.onLoadedMessageChange);
  useEffect(() => {
    onLoadedMessageChangeRef.current = loading?.onLoadedMessageChange;
  });
  const lastNotifiedTargetRef = useRef<string | null>(null);
  useEffect(() => {
    const key = activeEditTarget ? `${activeEditTarget.channelId}:${activeEditTarget.ts}` : null;
    if (lastNotifiedTargetRef.current === key) {
      return;
    }
    lastNotifiedTargetRef.current = key;
    onLoadedMessageChangeRef.current?.(activeEditTarget);
  }, [activeEditTarget]);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
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

  // Report the verdict to the host only when it actually changes: the hook
  // re-runs (with a fresh object identity) on every debounced pass, and the
  // callback prop is often an inline arrow, so both are deduped against the
  // last-notified key rather than used as change signals themselves.
  const lastNotifiedValidationRef = useRef<string | null>(null);
  useEffect(() => {
    if (!onValidationChange) {
      return;
    }
    const key = JSON.stringify([validationSummary.valid, validationSummary.errorCount, ...validationSummary.errors]);
    if (lastNotifiedValidationRef.current === key) {
      return;
    }
    lastNotifiedValidationRef.current = key;
    onValidationChange(validationSummary);
  }, [validationSummary, onValidationChange]);

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
            <div className="bk-root flex h-full w-full flex-col overflow-hidden rounded-md border bg-background text-foreground">
              <Toolbar
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
                  // Banner exit: discard the loaded message's draft and reopen
                  // the loader so the user starts fresh or picks another message.
                  setEditTarget(null);
                  replaceAll([]);
                  setLoadOpen(true);
                }}
                loadButtonLabel={loadButtonLabel}
                updateButtonLabel={updateButtonLabel}
              />
              <div className="flex min-h-0 flex-1 items-stretch">
                {/* Desktop: persistent left aside. Mobile: collapsed to the
                  palette sheet trigger in the toolbar. */}
                <div className="hidden min-h-0 md:flex">
                  <Palette
                    onAddBlock={(block) => addBlock(block)}
                    sections={paletteSections}
                    showSearch={showPaletteSearch}
                    searchPlaceholder={paletteSearchPlaceholder}
                    defaultOpenSections={defaultOpenSections}
                  />
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
                side="bottom"
                className="bk-portal-content flex h-[85svh] max-h-[85svh] flex-col gap-3 p-0 sm:max-w-none"
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
                    showSearch={showPaletteSearch}
                    searchPlaceholder={paletteSearchPlaceholder}
                    defaultOpenSections={defaultOpenSections}
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
                // The recent-messages picker needs a channel source to scope
                // its lookup; withhold the loader without one so only the
                // paste-link entry renders (warned at mount).
                loadRecentMessages={recentChannelSource ? loading.loadRecentMessages : undefined}
                loadChannels={recentChannelSource}
                onLoaded={(result) => {
                  replaceAll(result.blocks);
                  setEditTarget(toLoadedMessage(result));
                  setLoadOpen(false);
                }}
                onOpenAsNew={(loadedBlocks) => {
                  // Fallback for a not-editable verdict: drop edit mode and
                  // hydrate the draft (when the host supplied blocks) so the
                  // user can repost it as a brand-new message.
                  if (loadedBlocks) {
                    replaceAll(loadedBlocks);
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
