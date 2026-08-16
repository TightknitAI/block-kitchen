import {
  AlertTriangle,
  AppWindow,
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  Home,
  MessageSquare,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Redo2,
  Send,
  Sun,
  Trash2,
  Undo2,
  X
} from 'lucide-react';
import type { ComponentType, KeyboardEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Button } from '../lib/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../lib/ui/popover';
import { SlackMark } from '../lib/ui/slack-mark';
import type { PreviewSurface, PreviewTheme } from '../types';

const THEME_OPTIONS: {
  value: PreviewTheme;
  label: string;
  Icon: typeof Sun;
}[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon }
];

const SURFACE_OPTIONS: {
  value: PreviewSurface;
  label: string;
  Icon: typeof Sun;
}[] = [
  { value: 'message', label: 'Message', Icon: MessageSquare },
  { value: 'modal', label: 'Modal', Icon: AppWindow },
  { value: 'app_home', label: 'App Home', Icon: Home }
];

const DEFAULT_DOCS_HREF = 'https://docs.slack.dev/reference/block-kit/blocks';
const DEFAULT_DOCS_LABEL = 'Docs';

/**
 * Render a Slack message timestamp (`<unix-seconds>.<micro>`) as a readable
 * date for the edit-mode banner. Falls back to the raw value if it doesn't
 * parse as a number.
 */
function formatMessageTs(ts: string): string {
  const seconds = Number.parseFloat(ts);
  if (!Number.isFinite(seconds)) return ts;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return ts;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const SEND_MENU_ITEM =
  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

/**
 * Top toolbar with the preview theme picker, View JSON escape hatch, and
 * the Send action.
 * @param props - toolbar props
 * @param props.canUndo - whether the Undo button is enabled
 * @param props.canRedo - whether the Redo button is enabled
 * @param props.onUndo - steps the draft back one history entry
 * @param props.onRedo - steps the draft forward one history entry
 * @param props.onClear - resets the draft to empty (disabled when already empty)
 * @param props.onOpenJson - opens the JSON drawer
 * @param props.onOpenIssues - opens the issues sheet
 * @param props.onOpenSend - opens the send dialog
 * @param props.onOpenPalette - opens the mobile palette sheet
 * @param props.onTogglePalette - hides/restores the desktop palette rail.
 *   The toggle only renders when this is wired.
 * @param props.paletteCollapsed - whether that rail is currently hidden
 * @param props.canSend - whether the Send button should be enabled
 * @param props.canClear - whether the Clear button should be enabled
 * @param props.previewTheme - current preview theme
 * @param props.onPreviewThemeChange - called when the user picks a theme
 * @param props.previewSurface - which Slack surface to approximate
 * @param props.onPreviewSurfaceChange - called when the user picks a surface
 * @param props.allowedSurfaces - surfaces shown in the dropdown. When the
 *   list has 0 or 1 entry the dropdown is hidden entirely.
 * @param props.showThemeControl - render the theme dropdown (default true)
 * @param props.docsLink - customize or hide the Docs link. `false` hides it;
 *   an object overrides `href` and/or `label`. Defaults to the Slack Block
 *   Kit reference docs.
 * @param props.errorCount - number of validation errors
 * @param props.showSend - whether the send action renders at all (default
 *   true; false in compose-only mode)
 * @param props.primaryAction - host-owned button rendered in the primary
 *   slot when the built-in send action is hidden (compose-only mode)
 * @param props.sendButtonLabel - label + accessible name for the Send
 *   button that opens the send dialog. Defaults to `'Send'`.
 * @returns the rendered toolbar
 */
export function Toolbar({
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onClear,
  onOpenJson,
  onOpenIssues,
  onOpenSend,
  onOpenPalette,
  onTogglePalette,
  paletteCollapsed = false,
  canSend,
  canClear,
  previewTheme,
  onPreviewThemeChange,
  previewSurface,
  onPreviewSurfaceChange,
  allowedSurfaces,
  showThemeControl = true,
  docsLink,
  errorCount,
  showSend = true,
  primaryAction,
  sendButtonLabel = 'Review & send',
  loadEnabled = false,
  updateEnabled = false,
  editBadge,
  onOpenLoad,
  onOpenUpdate,
  onExitEdit,
  loadButtonLabel = 'Find message',
  updateButtonLabel = 'Review & update'
}: {
  /** Whether an undo step is available (enables the Undo button). */
  canUndo?: boolean;
  /** Whether a redo step is available (enables the Redo button). */
  canRedo?: boolean;
  /** Steps the draft back one history entry. Undo button is hidden if omitted. */
  onUndo?: () => void;
  /** Steps the draft forward one history entry. Redo button is hidden if omitted. */
  onRedo?: () => void;
  onClear: () => void;
  onOpenJson: () => void;
  onOpenIssues: () => void;
  onOpenSend: () => void;
  onOpenPalette?: () => void;
  /**
   * Hides/restores the desktop palette rail. Omitted (as by a host that
   * renders no rail) the toggle isn't rendered at all.
   */
  onTogglePalette?: () => void;
  /** Whether the desktop palette rail is currently hidden. Defaults to `false`. */
  paletteCollapsed?: boolean;
  canSend: boolean;
  canClear: boolean;
  previewTheme: PreviewTheme;
  onPreviewThemeChange: (theme: PreviewTheme) => void;
  previewSurface: PreviewSurface;
  onPreviewSurfaceChange: (surface: PreviewSurface) => void;
  allowedSurfaces: readonly PreviewSurface[];
  showThemeControl?: boolean;
  docsLink?: false | { href?: string; label?: string };
  errorCount: number;
  /**
   * Whether the send action (single button, or split button in edit mode)
   * renders at all. `false` in compose-only mode, where the host owns the
   * send flow. Defaults to `true`.
   */
  showSend?: boolean;
  /**
   * Host-owned button rendered in the primary slot when `showSend` is
   * false. Resolved by the parent: a plain click handler and a precomputed
   * disabled flag. `null`/omitted renders nothing in the slot.
   */
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean } | null;
  sendButtonLabel?: string;
  /**
   * Whether loading an existing message is configured: shows the
   * "Find message" entry and the loaded-message banner. Works in both send
   * mode and compose-only mode — loading is a composition concern.
   */
  loadEnabled?: boolean;
  /**
   * Whether the update-in-place flow is available (send mode with
   * `editing.onUpdate`). With a message loaded, `true` renders the primary
   * slot as the update split button; `false` keeps the plain send button
   * (the loaded message can still be posted as new).
   */
  updateEnabled?: boolean;
  /** When set, a message is loaded: renders the loaded-message banner. */
  editBadge?: { channelLabel: string; ts: string } | null;
  /** Opens the load-message dialog (the loading entry point). */
  onOpenLoad?: () => void;
  /** Opens the update dialog (split button's main action + "Update message"). */
  onOpenUpdate?: () => void;
  /** Switches back to a new message, clearing the loaded target. */
  onExitEdit?: () => void;
  /** Label for the load-message entry button. Defaults to `'Find message'`. */
  loadButtonLabel?: string;
  /** Label for the primary button while editing. Defaults to `'Review & update'`. */
  updateButtonLabel?: string;
}) {
  const activeTheme = THEME_OPTIONS.find((t) => t.value === previewTheme) ?? THEME_OPTIONS[0];
  const activeSurface = SURFACE_OPTIONS.find((s) => s.value === previewSurface) ?? SURFACE_OPTIONS[0];
  const surfaceOptions = SURFACE_OPTIONS.filter((s) => allowedSurfaces.includes(s.value));
  const showSurfaceControl = surfaceOptions.length > 1;
  const docsHref = docsLink === false ? null : (docsLink?.href ?? DEFAULT_DOCS_HREF);
  const docsLabel = docsLink === false ? null : (docsLink?.label ?? DEFAULT_DOCS_LABEL);

  // Controlled open state so we can close the menus after a selection — the
  // `role="menuitemradio"` semantics imply activation dismisses the menu.
  const [surfaceMenuOpen, setSurfaceMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [sendMenuOpen, setSendMenuOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b bg-background px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
          {loadEnabled ? (
            <Button type="button" size="sm" onClick={onOpenLoad} aria-label={loadButtonLabel}>
              {/* Slack's own mark rather than a monochrome lucide glyph: this
                  is the one button that reaches out into Slack, and the brand
                  colours say so at a glance. Same box as the icons beside it. */}
              <SlackMark className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{loadButtonLabel}</span>
            </Button>
          ) : null}
          {onOpenPalette ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenPalette}
              className="gap-1 md:hidden"
              aria-label="Add a block"
            >
              <Plus className="h-4 w-4" />
              <span>Blocks</span>
            </Button>
          ) : null}
          {onTogglePalette ? (
            // Desktop counterpart to the Blocks button above: there the
            // palette is a sheet that opens on demand, here it's a rail that
            // is always up — so this one hides and restores it. Icon at rest,
            // label on hover, like the Clear / View JSON pair opposite.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onTogglePalette}
              className="group hidden gap-0 md:inline-flex"
              aria-expanded={!paletteCollapsed}
              aria-label={paletteCollapsed ? 'Show block palette' : 'Hide block palette'}
              title={paletteCollapsed ? 'Show block palette' : 'Hide block palette'}
            >
              {paletteCollapsed ? (
                <PanelLeftOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" />
              )}
              <ExpandingLabel>Blocks</ExpandingLabel>
            </Button>
          ) : null}
          {showSurfaceControl ? (
            <Popover open={surfaceMenuOpen} onOpenChange={setSurfaceMenuOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label={`Preview surface: ${activeSurface.label}`}>
                  <activeSurface.Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{activeSurface.label}</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 md:inline" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-36 p-1">
                <Menu<PreviewSurface>
                  ariaLabel="Preview surface"
                  options={surfaceOptions}
                  value={previewSurface}
                  onChange={(next) => {
                    onPreviewSurfaceChange(next);
                    setSurfaceMenuOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : null}
          {showThemeControl ? (
            <Popover open={themeMenuOpen} onOpenChange={setThemeMenuOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="ghost" size="sm" aria-label={`Preview theme: ${activeTheme.label}`}>
                  <activeTheme.Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{activeTheme.label}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-32 p-1">
                <Menu<PreviewTheme>
                  ariaLabel="Preview theme"
                  options={THEME_OPTIONS}
                  value={previewTheme}
                  onChange={(next) => {
                    onPreviewThemeChange(next);
                    setThemeMenuOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          ) : null}
          {docsHref ? (
            <a
              href={docsHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label={`${docsLabel} (opens in a new tab)`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{docsLabel}</span>
              <ExternalLink className="hidden h-3 w-3 opacity-50 md:inline" />
            </a>
          ) : null}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {onUndo && onRedo ? (
            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
                className="px-2"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
                className="px-2"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null}
          {errorCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenIssues}
              // High-contrast error styling: red text on a light red background
              // with a subtle red border (WCAG AA — red-700 on red-50 ≈ 6.5:1),
              // so the issue count reads unmistakably as an error rather than a
              // muted ghost button. The `!` on the border color beats the
              // unlayered `.bk-root *` border-color reset in styles.src.css,
              // which otherwise clobbers any utility border color back to the
              // neutral `--border` token.
              className="border border-red-200! bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-700"
              aria-label={`${errorCount} ${errorCount === 1 ? 'issue' : 'issues'}`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>
                {errorCount} <span className="hidden md:inline">{errorCount === 1 ? 'issue' : 'issues'}</span>
              </span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={!canClear}
            className="group gap-0 hover:bg-destructive/10 hover:text-destructive"
            aria-label="Clear all blocks"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <ExpandingLabel>Clear</ExpandingLabel>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenJson}
            className="group gap-0"
            aria-label="View JSON"
          >
            <Code2 className="h-3.5 w-3.5" />
            <ExpandingLabel>View JSON</ExpandingLabel>
          </Button>
          {!showSend ? (
            primaryAction ? (
              // Compose-only mode with a host-owned primary action: same
              // placement and styling as the built-in send button. No icon —
              // the action's meaning is the host's, so the label always shows
              // (the send button can collapse to its icon on small screens;
              // an icon-less button can't).
              <Button
                type="button"
                size="sm"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                aria-label={primaryAction.label}
              >
                <span>{primaryAction.label}</span>
              </Button>
            ) : null
          ) : editBadge && updateEnabled ? (
            // A message is loaded and update-in-place is wired: split button.
            // Main action updates it in place; the menu also offers posting
            // the blocks as a new message. Without `updateEnabled` (loading
            // configured but no `editing.onUpdate`), the plain send button
            // below stays — the loaded message can only be posted as new.
            <div className="flex items-stretch">
              <Button
                type="button"
                size="sm"
                onClick={onOpenUpdate}
                disabled={!canSend}
                aria-label={updateButtonLabel}
                className="rounded-r-none"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{updateButtonLabel}</span>
              </Button>
              <Popover open={sendMenuOpen} onOpenChange={setSendMenuOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    aria-label="More message options"
                    aria-haspopup="menu"
                    className="rounded-l-none border-l border-l-primary-foreground/30! px-1.5"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-1">
                  <div role="menu" aria-label="Message options" className="flex flex-col">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!canSend}
                      onClick={() => {
                        setSendMenuOpen(false);
                        onOpenUpdate?.();
                      }}
                      className={SEND_MENU_ITEM}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="flex-1">Update message</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={!canSend}
                      onClick={() => {
                        setSendMenuOpen(false);
                        onOpenSend();
                      }}
                      className={SEND_MENU_ITEM}
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="flex-1">Send as a new message</span>
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <Button type="button" size="sm" onClick={onOpenSend} disabled={!canSend} aria-label={sendButtonLabel}>
              <Send className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{sendButtonLabel}</span>
            </Button>
          )}
        </div>
      </div>
      {loadEnabled && editBadge ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted px-2 py-2 text-foreground sm:px-3">
          <Pencil className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 text-sm">
            References an existing message in <span className="font-semibold">{editBadge.channelLabel}</span>
            <span className="ml-1 text-xs opacity-70" title={editBadge.ts}>
              {formatMessageTs(editBadge.ts)}
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onExitEdit} className="shrink-0">
            <X className="h-3.5 w-3.5" />
            Switch to a new message
          </Button>
        </div>
      ) : null}
    </>
  );
}

/**
 * A toolbar label that rests collapsed at zero width and slides open on
 * hover or keyboard focus, leaving the icon as the button's resting state.
 * Keeps the secondary utilities (Clear, View JSON) a compact icon cluster
 * with the name one hover or one Tab away.
 *
 * Animated as a `0fr` → `1fr` grid track, since the flex factor
 * interpolates to the item's max-content width and `width: auto` can't.
 * All three elements are load-bearing: the grid owns the track, the middle
 * span is the item sized to it and clipping, and the inner block carries
 * the gap to the icon — padding on the clipped item would survive the
 * collapse, since `border-box` floors width at padding. Callers pass
 * `gap-0` for the same reason.
 *
 * The text stays in the DOM, but these buttons all carry an `aria-label`,
 * so it was never the accessible name.
 * @param props - label props
 * @param props.children - the label text to reveal
 * @returns the rendered expanding label
 */
function ExpandingLabel({ children }: { children: ReactNode }) {
  return (
    <span
      className={cn(
        'grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out',
        'group-hover:grid-cols-[1fr] group-focus-visible:grid-cols-[1fr]',
        'motion-reduce:transition-none'
      )}
    >
      <span className="overflow-hidden">
        <span className="block whitespace-nowrap pl-1.5">{children}</span>
      </span>
    </span>
  );
}

/**
 * Single-select dropdown menu rendered inside a Popover. Adds proper
 * `role="menu"` / `role="menuitem"` semantics and arrow-key navigation
 * between options. Avoiding `@radix-ui/react-dropdown-menu` keeps this
 * dependency-free; the wrapping `Popover` already handles outside-click
 * dismiss, focus return, and Escape.
 */
function Menu<T extends string>({
  ariaLabel,
  options,
  value,
  onChange
}: {
  ariaLabel: string;
  options: readonly { value: T; label: string; Icon: ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (next: T) => void;
}) {
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const moveFocus = (from: number, delta: number) => {
    const len = options.length;
    if (len === 0) return;
    const next = (from + delta + len) % len;
    itemsRef.current[next]?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(idx, 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(idx, -1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemsRef.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itemsRef.current[options.length - 1]?.focus();
    }
  };

  return (
    <div role="menu" aria-label={ariaLabel} className="flex flex-col">
      {options.map(({ value: optValue, label, Icon }, idx) => {
        const isActive = optValue === value;
        return (
          <button
            key={optValue}
            ref={(el) => {
              itemsRef.current[idx] = el;
            }}
            type="button"
            role="menuitemradio"
            aria-checked={isActive}
            onClick={() => onChange(optValue)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:outline-none',
              isActive ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="flex-1">{label}</span>
            {isActive ? <Check className="h-3.5 w-3.5" /> : null}
          </button>
        );
      })}
    </div>
  );
}
