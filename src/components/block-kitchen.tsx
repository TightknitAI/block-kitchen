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
import { useCallback, useMemo, useState } from 'react';
import { parseContainerBodyId } from '../lib/container-blocks';
import { makeEmojiHook } from '../lib/custom-emoji-hook';
import { buildVariantById, defaultPalette, type PaletteSection } from '../lib/default-blocks';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../lib/ui/sheet';
import { TooltipProvider } from '../lib/ui/tooltip';
import { useIsMobile } from '../lib/use-is-mobile';
import { CustomEmojiProvider } from '../state/custom-emoji-context';
import { useBlockKitValidation } from '../state/use-block-kit-validation';
import { type MoveTarget, useBlockKitchenState } from '../state/use-block-kitchen-state';
import type { BlockKitchenProps, PreviewSurface, PreviewTheme } from '../types';
import { BrandThemeScope } from './brand-theme-scope';
import { IssuesSheet } from './issues-sheet';
import { JsonDrawer } from './json-drawer';
import { LoadMessageDialog } from './load-message-dialog';
import { Palette, parsePaletteDragId } from './palette';
import { SendDialog } from './send-dialog';
import { SURFACE_DROPPABLE_ID, Surface } from './surface';
import { Toolbar } from './toolbar';
import { type EditTarget, UpdateDialog } from './update-dialog';

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
    previewHooks,
    customEmojis,
    loadChannels,
    loadSendAsUserStatus,
    onSend,
    editing,
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
  } = props;

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

  const { blocks, addBlock, addChild, updateBlock, removeBlock, duplicateBlock, reorderBlock, moveBlock, replaceAll } =
    useBlockKitchenState({ initialBlocks, onChange });

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
  // Edit mode (opt-in via `editing`). `editTarget` is the loaded message;
  // when set, the split button can update it in place (`updateOpen`) or post
  // the current blocks as a new message (`sendOpen`).
  const [updateOpen, setUpdateOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  // Edit mode only counts as active while `editing` is configured. If the host
  // toggles `editing` off mid-session, fall back to send-only without losing
  // the loaded target (it reactivates if `editing` returns).
  const activeEditTarget = editing ? editTarget : null;
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
                sendButtonLabel={sendButtonLabel}
                editingEnabled={!!editing}
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
              dialog (channel locked) only exists while a message is loaded. */}
            <SendDialog
              open={sendOpen}
              onOpenChange={setSendOpen}
              blocks={blockPayloads}
              loadChannels={loadChannels}
              loadSendAsUserStatus={loadSendAsUserStatus}
              onSend={onSend}
              confirmSendLabel={confirmSendLabel}
              errorCount={validation.total}
              onShowIssues={() => {
                setSendOpen(false);
                setIssuesOpen(true);
              }}
            />
            {activeEditTarget && editing ? (
              <UpdateDialog
                open={updateOpen}
                onOpenChange={setUpdateOpen}
                target={activeEditTarget}
                blocks={blockPayloads}
                loadSendAsUserStatus={loadSendAsUserStatus}
                onUpdate={editing.onUpdate}
                confirmUpdateLabel={confirmUpdateLabel}
                errorCount={validation.total}
                onShowIssues={() => {
                  setUpdateOpen(false);
                  setIssuesOpen(true);
                }}
              />
            ) : null}
            {editing ? (
              <LoadMessageDialog
                open={loadOpen}
                onOpenChange={setLoadOpen}
                onLoadMessage={editing.onLoadMessage}
                loadRecentMessages={editing.loadRecentMessages}
                loadChannels={loadChannels}
                onLoaded={(result) => {
                  replaceAll(result.blocks);
                  setEditTarget({
                    channelId: result.channelId,
                    channelName: result.channelName,
                    ts: result.ts,
                    editableVia: result.editableVia,
                    workspaceName: result.workspaceName,
                    username: result.username,
                    iconUrl: result.iconUrl
                  });
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
