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
  Pencil,
  Plus,
  Send,
  Sun,
  Trash2,
  X
} from 'lucide-react';
import type { ComponentType, KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Button } from '../lib/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../lib/ui/popover';
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

const SEND_MENU_ITEM =
  'flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50';

/**
 * Top toolbar with the preview theme picker, View JSON escape hatch, and
 * the Send action.
 * @param props - toolbar props
 * @param props.onClear - resets the draft to empty (disabled when already empty)
 * @param props.onOpenJson - opens the JSON drawer
 * @param props.onOpenIssues - opens the issues sheet
 * @param props.onOpenSend - opens the send dialog
 * @param props.onOpenPalette - opens the mobile palette sheet
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
 * @param props.sendButtonLabel - label + accessible name for the Send
 *   button that opens the send dialog. Defaults to `'Send'`.
 * @returns the rendered toolbar
 */
export function Toolbar({
  onClear,
  onOpenJson,
  onOpenIssues,
  onOpenSend,
  onOpenPalette,
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
  sendButtonLabel = 'Review & send',
  editingEnabled = false,
  editBadge,
  onOpenLoad,
  onOpenUpdate,
  onExitEdit,
  loadButtonLabel = 'Load message',
  updateButtonLabel = 'Review & update'
}: {
  onClear: () => void;
  onOpenJson: () => void;
  onOpenIssues: () => void;
  onOpenSend: () => void;
  onOpenPalette?: () => void;
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
  sendButtonLabel?: string;
  /** Whether edit mode is configured (shows the "Edit existing message" entry). */
  editingEnabled?: boolean;
  /** When set, a message is loaded for editing: renders the edit-mode badge. */
  editBadge?: { channelLabel: string; ts: string } | null;
  /** Opens the load-message dialog (edit-mode entry point). */
  onOpenLoad?: () => void;
  /** Opens the update dialog (split button's main action + "Update message"). */
  onOpenUpdate?: () => void;
  /** Switches back to a new message, clearing the loaded edit target. */
  onExitEdit?: () => void;
  /** Label for the load-message entry button. Defaults to `'Load message'`. */
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
          {editingEnabled && !editBadge ? (
            <Button type="button" size="sm" onClick={onOpenLoad} aria-label={loadButtonLabel}>
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{loadButtonLabel}</span>
            </Button>
          ) : null}
          {onOpenPalette ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenPalette}
              className="md:hidden"
              aria-label="Add a block"
            >
              <Plus className="h-4 w-4" />
              <span>Blocks</span>
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
            className="hover:bg-destructive/10 hover:text-destructive"
            aria-label="Clear all blocks"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Clear</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onOpenJson} aria-label="View JSON">
            <Code2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">View JSON</span>
          </Button>
          {editBadge ? (
            // A message is loaded: split button. Main action updates it in
            // place; the menu also offers posting the blocks as a new message.
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
      {editingEnabled && editBadge ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted px-2 py-2 text-foreground sm:px-3">
          <Pencil className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 text-sm">
            References an existing message in <span className="font-semibold">{editBadge.channelLabel}</span>
            <span className="ml-1 font-mono text-xs opacity-70">{editBadge.ts}</span>
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
