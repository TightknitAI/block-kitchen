import { AlertTriangle, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Button } from '../lib/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/ui/dialog';
import { Input } from '../lib/ui/input';
import { Label } from '../lib/ui/label';
import { isSafeHref, isSafeImageSrc } from '../lib/url-safety';
import type {
  ChannelOption,
  EditableVia,
  LoadResult,
  PreviewHooks,
  PreviewTheme,
  RecentMessage,
  SupportedBlock
} from '../types';
import { SlackMessagePreview } from './preview/slack-message-preview';
import { SlackSignInButton } from './slack-sign-in';

/**
 * How long the link input sits idle before we resolve it for the preview.
 * `onLoadMessage` is a network round-trip on the host side, so it must not
 * run per keystroke.
 */
const LINK_DEBOUNCE_MS = 400;

/** Copy under the link input explaining where a Slack message link comes from. */
const LINK_HELP_TEXT =
  'Click the ⠇menu while hovering over the message in Slack (or right-click), and select "Copy Link". Paste here.';

/** The left pane's two entry points. Order drives arrow-key navigation. */
const TABS = [
  { id: 'recent', label: 'Pick from Recent' },
  { id: 'link', label: 'Direct Link' }
] as const;

type TabId = (typeof TABS)[number]['id'];

/** Map a {@link RecentMessage} onto the `ok` verdict so it reuses the load path. */
function recentToResult(msg: RecentMessage): Extract<LoadResult, { ok: true }> {
  return {
    ok: true,
    channelId: msg.channelId,
    channelName: msg.channelName,
    ts: msg.ts,
    blocks: msg.blocks,
    editableVia: msg.editableVia ?? 'bot',
    workspaceName: msg.workspaceName,
    username: msg.username,
    iconUrl: msg.iconUrl
  };
}

/**
 * Snippet shown as the row body: the host's `label` if given, else the first
 * header/section text from the message blocks, else a block-count fallback.
 */
function previewText(m: RecentMessage): string {
  if (m.label) {
    return m.label;
  }
  for (const b of m.blocks) {
    if ((b.type === 'header' || b.type === 'section') && 'text' in b && b.text && 'text' in b.text) {
      return b.text.text;
    }
  }
  return `${m.blocks.length} block${m.blocks.length === 1 ? '' : 's'}`;
}

/**
 * Render a Slack `ts` as the time shown in the preview's message header.
 * Returns `''` for a missing or unparseable timestamp so the header simply
 * omits it rather than showing "Invalid Date".
 */
function formatTs(ts?: string): string {
  const seconds = Number(ts);
  if (!ts || !Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }
  return new Date(seconds * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Verdict label mirroring the row badge: which token can edit the message. */
function editableLabel(editableVia: EditableVia): string {
  return editableVia === 'user' ? 'You' : 'Bot';
}

/**
 * The message the right-hand pane is previewing, whether it came from the
 * recent list or from resolving a pasted link.
 */
interface PreviewTarget {
  blocks: SupportedBlock[];
  channelName?: string;
  channelId?: string;
  ts?: string;
  username?: string;
  iconUrl?: string;
  workspaceName?: string;
  editableVia?: EditableVia;
}

/** Resolution state of the pasted link, driving both the preview and the load. */
type LinkStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; result: Extract<LoadResult, { ok: true }> }
  | { kind: 'not-editable'; reason: string; blocks?: SupportedBlock[]; oauthUrl?: string }
  | { kind: 'error'; error: string };

/** What the preview pane renders for the active tab. */
type PreviewState =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | { kind: 'not-editable'; reason: string; blocks?: SupportedBlock[]; oauthUrl?: string }
  | { kind: 'ready'; target: PreviewTarget };

/**
 * Edit-mode entry point. Two panes: the left collects a message (a recent
 * message the app posted, or a pasted Slack permalink), the right previews
 * whichever one is currently selected so the user commits to a message they
 * can see rather than a link they can't.
 *
 * On a successful load the parent flips into edit mode (`onLoaded`); on a
 * not-editable verdict the preview pane renders the host's `reason` and, when
 * that verdict carries blocks, previews them alongside "Open as a new message
 * instead" (a no-match verdict has none, so only the reason shows).
 *
 * The package never parses the permalink — the host extracts `channel + ts`.
 * @param props - dialog props
 * @param props.open - whether the dialog is open
 * @param props.onOpenChange - notified when the user closes the dialog
 * @param props.onLoadMessage - host loader returning an editability verdict
 * @param props.loadRecentMessages - optional loader for the "recent messages" picker, scoped to a channel
 * @param props.loadChannels - returns channels to scope the recent-messages picker by; the
 *   "Pick from Recent" tab only renders when both this and `loadRecentMessages` are provided
 * @param props.onLoaded - called with the `ok` result so the parent enters edit mode
 * @param props.onOpenAsNew - called with optional blocks for the "open as new" fallback
 * @param props.previewHooks - directive hooks forwarded to the preview pane
 * @param props.previewTheme - light or dark preview theme, matching the builder's
 * @returns the rendered load-message dialog
 */
export function LoadMessageDialog({
  open,
  onOpenChange,
  onLoadMessage,
  loadRecentMessages,
  loadChannels,
  onLoaded,
  onOpenAsNew,
  previewHooks,
  previewTheme = 'light'
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadMessage: (input: { link: string }) => Promise<LoadResult>;
  loadRecentMessages?: (channelId: string) => Promise<RecentMessage[]>;
  loadChannels?: () => Promise<ChannelOption[]>;
  onLoaded: (result: Extract<LoadResult, { ok: true }>) => void;
  onOpenAsNew: (blocks?: SupportedBlock[]) => void;
  previewHooks?: PreviewHooks;
  previewTheme?: PreviewTheme;
}) {
  const [link, setLink] = useState('');
  const [linkStatus, setLinkStatus] = useState<LinkStatus>({ kind: 'idle' });
  // Only raised by submitting an empty link; the resolution states above own
  // every other link failure.
  const [emptyLinkError, setEmptyLinkError] = useState<string | null>(null);
  // True while the footer button's own load round-trip is in flight (as
  // opposed to the debounced preview lookup, which must not disable it).
  const [committing, setCommitting] = useState(false);
  // Channel selector for the recent-messages picker (only when `loadRecentMessages`
  // is given). The user must pick a channel before any recent lookup runs.
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string>('');
  // Recent messages for the selected channel. `null` means "loading / not loaded yet".
  const [recent, setRecent] = useState<RecentMessage[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  // The recent-message row the user has picked: previewed on the right, and
  // loaded by the footer button while the Recent tab is active.
  const [selectedRecent, setSelectedRecent] = useState<RecentMessage | null>(null);
  // True while re-checking the load after the user opened the Slack OAuth tab
  // from a "sign in to edit" verdict.
  const [signInPolling, setSignInPolling] = useState(false);
  const [tab, setTab] = useState<TabId>('recent');
  const inputRef = useRef<HTMLInputElement>(null);
  const signInPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The link the current `linkStatus` describes. Lets the debounced lookup
  // skip a link the footer button already resolved (and vice versa).
  const resolvedLinkRef = useRef<string | null>(null);
  // Monotonic id so a slow lookup can't overwrite the verdict of a newer one.
  const linkRequestRef = useRef(0);
  const domId = useId();
  const tabDomId = (id: TabId) => `${domId}-${id}-tab`;
  const panelDomId = (id: TabId) => `${domId}-${id}-panel`;

  // Hold the latest loaders in refs so they can change identity between renders
  // (consumers often pass a fresh arrow) without us needing them as deps.
  const onLoadMessageRef = useRef(onLoadMessage);
  const loadRecentMessagesRef = useRef(loadRecentMessages);
  const loadChannelsRef = useRef(loadChannels);
  useEffect(() => {
    onLoadMessageRef.current = onLoadMessage;
    loadRecentMessagesRef.current = loadRecentMessages;
    loadChannelsRef.current = loadChannels;
  });

  // The recent-messages picker needs both a message loader and a channel
  // source to scope it by; with either missing, the tab strip is withheld
  // entirely and the link pane stands alone (compose-only hosts may have no
  // channel list at all) — a lone tab would be chrome around nothing.
  const hasRecent = !!loadRecentMessages && !!loadChannels;
  const activeTab: TabId = hasRecent ? tab : 'link';

  // Reset to a clean slate each time the dialog opens. Kept separate from
  // the channel fetch below so a mid-open re-fetch can't wipe the user's
  // typed link or picked selection.
  useEffect(() => {
    if (!open) {
      return;
    }
    setLink('');
    setLinkStatus({ kind: 'idle' });
    setEmptyLinkError(null);
    setCommitting(false);
    setChannelId('');
    setRecent(null);
    setRecentError(null);
    setSelectedRecent(null);
    setTab('recent');
    resolvedLinkRef.current = null;
    linkRequestRef.current += 1;
  }, [open]);

  // Load the channel list that scopes the recent-messages picker. Depends on
  // `hasRecent` (live props), not just `open`, so a channel source that
  // arrives while the dialog is already open (e.g. a host wiring the send
  // trio after async bootstrap) still populates the picker.
  useEffect(() => {
    const load = loadChannelsRef.current;
    if (!open || !hasRecent || !load) {
      setChannels([]);
      setChannelsError(null);
      return;
    }
    setChannels(null);
    setChannelsError(null);
    let cancelled = false;
    load()
      .then((list) => {
        if (!cancelled) {
          setChannels(list);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setChannelsError(e instanceof Error ? e.message : 'Failed to load channels');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, hasRecent]);

  // (Re)load the recent list whenever the selected channel changes, scoping the
  // lookup to that one channel.
  useEffect(() => {
    if (!open || !loadRecentMessagesRef.current || !channelId) {
      return;
    }
    setRecent(null);
    setRecentError(null);
    setSelectedRecent(null);
    let cancelled = false;
    loadRecentMessagesRef
      .current(channelId)
      .then((list) => {
        if (!cancelled) {
          setRecent(list);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRecentError(e instanceof Error ? e.message : 'Failed to load recent messages.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, channelId]);

  const stopSignInPoll = useCallback(() => {
    if (signInPollRef.current) {
      clearInterval(signInPollRef.current);
      signInPollRef.current = null;
    }
    setSignInPolling(false);
  }, []);

  // Stop the sign-in retry loop when the dialog closes or the component unmounts.
  useEffect(() => {
    if (!open) {
      stopSignInPoll();
    }
    return stopSignInPoll;
  }, [open, stopSignInPoll]);

  /**
   * Ask the host about `trimmed` and record the verdict. Shared by the
   * debounced preview lookup and the footer button, so both paths land on the
   * same state (and the second one to want a given link reuses the first's
   * answer instead of re-fetching it).
   */
  const resolveLink = useCallback(async (trimmed: string): Promise<LoadResult | null> => {
    const requestId = ++linkRequestRef.current;
    setLinkStatus({ kind: 'loading' });
    try {
      const result = await onLoadMessageRef.current({ link: trimmed });
      if (linkRequestRef.current !== requestId) {
        return null; // superseded by a newer link
      }
      resolvedLinkRef.current = trimmed;
      setLinkStatus(
        result.ok
          ? { kind: 'ready', result }
          : { kind: 'not-editable', reason: result.reason, blocks: result.blocks, oauthUrl: result.oauthUrl }
      );
      return result;
    } catch (e) {
      if (linkRequestRef.current !== requestId) {
        return null;
      }
      resolvedLinkRef.current = trimmed;
      setLinkStatus({ kind: 'error', error: e instanceof Error ? e.message : 'Failed to load message.' });
      return null;
    }
  }, []);

  // Preview whatever link is in the box, debounced — `onLoadMessage` is a
  // host-side network call, so it must not run per keystroke.
  useEffect(() => {
    if (!open) {
      return;
    }
    const trimmed = link.trim();
    if (!trimmed) {
      linkRequestRef.current += 1; // abandon any in-flight lookup
      resolvedLinkRef.current = null;
      setLinkStatus({ kind: 'idle' });
      return;
    }
    if (resolvedLinkRef.current === trimmed) {
      return; // already resolved (typed back to a link we've looked up)
    }
    const timer = setTimeout(() => {
      // The footer button may have resolved this exact link while we waited.
      if (resolvedLinkRef.current !== trimmed) {
        void resolveLink(trimmed);
      }
    }, LINK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, link, resolveLink]);

  const handleLoad = async () => {
    stopSignInPoll();
    // A picked recent message loads directly — it's already fully resolved, so
    // there's no link to fetch.
    if (activeTab === 'recent') {
      if (selectedRecent) {
        onLoaded(recentToResult(selectedRecent));
      }
      return;
    }
    const trimmed = link.trim();
    if (!trimmed) {
      setEmptyLinkError('Paste a Slack message link first.');
      return;
    }
    // Reuse an editable verdict the preview already fetched for this exact
    // link; anything else re-checks, so a failed verdict can be retried from
    // the same button.
    if (linkStatus.kind === 'ready' && resolvedLinkRef.current === trimmed) {
      onLoaded(linkStatus.result);
      return;
    }
    setCommitting(true);
    const result = await resolveLink(trimmed);
    setCommitting(false);
    if (result?.ok) {
      onLoaded(result);
    }
  };

  // Opens the Slack OAuth tab, then re-runs the load on an interval so the
  // dialog advances into edit mode once the host reports the message editable
  // (i.e. the user finished signing in). Capped so it can't poll forever.
  const startFindSignIn = (oauthUrl: string) => {
    if (!isSafeHref(oauthUrl)) {
      return;
    }
    const trimmed = link.trim();
    if (!trimmed) {
      return;
    }
    window.open(oauthUrl, '_blank', 'noopener,noreferrer');
    stopSignInPoll();
    setSignInPolling(true);
    let tries = 0;
    const POLL_INTERVAL_MS = 2500;
    const MAX_POLLS = 24; // ~1 minute before giving up
    signInPollRef.current = setInterval(() => {
      tries += 1;
      onLoadMessageRef
        .current({ link: trimmed })
        .then((result) => {
          if (result.ok) {
            stopSignInPoll();
            onLoaded(result);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (tries >= MAX_POLLS) {
            stopSignInPoll();
          }
        });
    }, POLL_INTERVAL_MS);
  };

  // The preview always reflects the active tab's own selection: the picked
  // recent row, or the resolved pasted link. Switching tabs therefore swaps
  // the preview back to that tab's message (or the empty state).
  const preview: PreviewState =
    activeTab === 'recent'
      ? selectedRecent
        ? { kind: 'ready', target: { ...selectedRecent, editableVia: selectedRecent.editableVia ?? 'bot' } }
        : { kind: 'empty' }
      : linkStatus.kind === 'idle'
        ? { kind: 'empty' }
        : linkStatus.kind === 'ready'
          ? { kind: 'ready', target: linkStatus.result }
          : linkStatus;

  const canLoad = activeTab === 'recent' ? !!selectedRecent : !!link.trim();

  // Only offer the tabpanel wiring when there is a tab strip to label it.
  const panelProps = (id: TabId) =>
    hasRecent ? { role: 'tabpanel' as const, id: panelDomId(id), 'aria-labelledby': tabDomId(id) } : {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85svh] w-[calc(100vw-1.5rem)] flex-col rounded-lg lg:max-w-4xl"
        // With no tab strip the link input is the entry point, so focus it
        // directly instead of leaving focus on the dialog chrome.
        onOpenAutoFocus={(e) => {
          if (hasRecent) {
            return;
          }
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>Find an existing message</DialogTitle>
          <DialogDescription>
            {hasRecent
              ? 'Pick a recent message your app posted, or paste a Slack message link. Preview it before loading.'
              : 'Paste a Slack message link (Slack\'s "Copy link") to preview it and load its blocks for editing.'}
          </DialogDescription>
        </DialogHeader>

        {/* Two panes side by side on wide viewports, stacked below that. Each
            pane grows inside this flex box and scrolls on its own, so neither
            can push the pinned header/footer around. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto lg:flex-row lg:gap-5 lg:overflow-hidden">
          <div className="flex min-w-0 shrink-0 flex-col gap-3 lg:min-h-0 lg:w-[19rem]">
            {hasRecent && (
              <TabStrip activeTab={activeTab} onSelect={setTab} tabDomId={tabDomId} panelDomId={panelDomId} />
            )}

            {activeTab === 'recent' ? (
              <div
                {...panelProps('recent')}
                className="flex min-w-0 flex-col gap-2 lg:min-h-0 lg:flex-1 lg:overflow-hidden"
              >
                {/* Pick a channel first — the recent lookup is scoped to it. */}
                <div className="flex shrink-0 flex-col gap-1.5">
                  <Label htmlFor="recent-channel-picker">Channel</Label>
                  {channels === null && !channelsError && (
                    <p className="text-xs text-muted-foreground">Loading channels…</p>
                  )}
                  {channelsError && <p className="text-xs text-destructive">{channelsError}</p>}
                  {channels && channels.length === 0 && !channelsError && (
                    <p className="text-xs text-muted-foreground">No public channels available.</p>
                  )}
                  {channels && channels.length > 0 && (
                    <select
                      id="recent-channel-picker"
                      value={channelId}
                      onChange={(e) => setChannelId(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="" disabled>
                        Select a channel…
                      </option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          #{c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {!channelId && channels && channels.length > 0 && (
                  <p className="shrink-0 text-xs text-muted-foreground">Select a channel to see recent messages.</p>
                )}
                {channelId && recent === null && !recentError && (
                  <p className="shrink-0 text-xs text-muted-foreground">Loading recent messages…</p>
                )}
                {channelId && recentError && <p className="shrink-0 text-xs text-destructive">{recentError}</p>}
                {channelId && recent && recent.length === 0 && !recentError && (
                  <p className="shrink-0 text-xs text-muted-foreground">
                    No recent messages from this app in this channel.
                  </p>
                )}
                {/* The list is the panel's one flexible child: capped on narrow
                    viewports, and on wide ones it takes whatever height the
                    channel picker leaves and scrolls inside that. */}
                {channelId && recent && recent.length > 0 && (
                  <div className="flex max-h-60 min-h-0 min-w-0 flex-col gap-1 overflow-y-auto lg:max-h-none lg:flex-1">
                    {recent.map((m) => {
                      // Which identity the message was posted as — drives both
                      // this badge and (on load) the token the update uses.
                      const asUser = (m.editableVia ?? 'bot') === 'user';
                      const authorName = m.username || (asUser ? 'You' : 'App bot');
                      const safeIcon = isSafeImageSrc(m.iconUrl) ? m.iconUrl : undefined;
                      const isSelected = selectedRecent?.channelId === m.channelId && selectedRecent?.ts === m.ts;
                      return (
                        <button
                          key={`${m.channelId}:${m.ts}`}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            // Pick the row; the footer button does the load.
                            setSelectedRecent(m);
                          }}
                          className={cn(
                            // Inset rings so the scroll container's overflow clip
                            // can't shave the corners off the selected outline.
                            'flex min-w-0 items-start gap-2.5 rounded-md border border-input bg-background px-3 py-2 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                            isSelected && 'border-primary! bg-accent ring-1 ring-inset ring-primary'
                          )}
                        >
                          {/* Slack-style square avatar. */}
                          {safeIcon ? (
                            <img src={safeIcon} alt="" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                          ) : (
                            <span
                              aria-hidden
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-semibold text-muted-foreground"
                            >
                              {authorName.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-foreground">{authorName}</span>
                              <span className="shrink-0 rounded border px-1 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {asUser ? 'You' : 'Bot'}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(Number(m.ts) * 1000).toLocaleString()}{' '}
                              <span className="font-mono">({m.ts})</span>
                            </span>
                            <span className="line-clamp-2 text-sm text-foreground">{previewText(m)}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div
                {...panelProps('link')}
                className="flex min-w-0 flex-col gap-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="message-link">Message link</Label>
                  <Input
                    ref={inputRef}
                    id="message-link"
                    value={link}
                    onChange={(e) => {
                      setLink(e.target.value);
                      setEmptyLinkError(null);
                      // A new link abandons any in-flight sign-in retry for the old one.
                      stopSignInPoll();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !committing) {
                        e.preventDefault();
                        handleLoad();
                      }
                    }}
                    placeholder="https://your-workspace.slack.com/archives/C…/p…"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <p className="text-xs leading-relaxed text-muted-foreground">{LINK_HELP_TEXT}</p>
                </div>

                {emptyLinkError && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    {emptyLinkError}
                  </p>
                )}
              </div>
            )}
          </div>

          <PreviewPane
            state={preview}
            hooks={previewHooks}
            theme={previewTheme}
            emptyHint={
              activeTab === 'recent'
                ? 'Select a recent message to preview it here.'
                : 'Paste a message link to preview it here.'
            }
            signInPolling={signInPolling}
            onSignIn={startFindSignIn}
            onOpenAsNew={onOpenAsNew}
          />
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleLoad} disabled={committing || !canLoad}>
            {committing ? 'Loading…' : 'Load message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tab strip for the left pane, hand-rolled rather than pulled from another
 * Radix package so the load dialog adds no peer dependency. Follows the
 * WAI-ARIA tabs pattern with automatic activation: roving `tabIndex`,
 * `aria-selected` on the active tab, and arrow / Home / End navigation that
 * moves focus and selection together.
 * @param props - tab strip props
 * @param props.activeTab - the currently selected tab
 * @param props.onSelect - called with the tab the user moved to
 * @param props.tabDomId - maps a tab id to its DOM id
 * @param props.panelDomId - maps a tab id to its panel's DOM id
 * @returns the rendered tab strip
 */
function TabStrip({
  activeTab,
  onSelect,
  tabDomId,
  panelDomId
}: {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  tabDomId: (tab: TabId) => string;
  panelDomId: (tab: TabId) => string;
}) {
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const moveTo = (next: TabId) => {
    onSelect(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div role="tablist" aria-label="Message source" className="flex shrink-0 gap-1 rounded-md bg-muted p-1">
      {TABS.map((entry, index) => {
        const selected = entry.id === activeTab;
        return (
          <button
            key={entry.id}
            ref={(node) => {
              tabRefs.current[entry.id] = node;
            }}
            type="button"
            role="tab"
            id={tabDomId(entry.id)}
            aria-selected={selected}
            aria-controls={panelDomId(entry.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(entry.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const delta = e.key === 'ArrowRight' ? 1 : -1;
                moveTo(TABS[(index + delta + TABS.length) % TABS.length].id);
              } else if (e.key === 'Home') {
                e.preventDefault();
                moveTo(TABS[0].id);
              } else if (e.key === 'End') {
                e.preventDefault();
                moveTo(TABS[TABS.length - 1].id);
              }
            }}
            className={cn(
              'flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {entry.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Right-hand pane: a full render of the selected message, scrolling on its
 * own so a long message can't move the dialog's footer. Loading, empty, and
 * failure states are handled here and here only — the left pane's controls
 * stay usable whatever the preview is showing.
 * @param props - pane props
 * @param props.state - what to render for the active tab
 * @param props.hooks - directive hooks forwarded to the block renderer
 * @param props.theme - light or dark preview theme
 * @param props.emptyHint - copy for the "nothing selected yet" state
 * @param props.signInPolling - whether a sign-in re-check is in flight
 * @param props.onSignIn - starts the Slack OAuth flow for a sign-in verdict
 * @param props.onOpenAsNew - called with the verdict's blocks for the "open as new" fallback
 * @returns the rendered preview pane
 */
function PreviewPane({
  state,
  hooks,
  theme,
  emptyHint,
  signInPolling,
  onSignIn,
  onOpenAsNew
}: {
  state: PreviewState;
  hooks?: PreviewHooks;
  theme: PreviewTheme;
  emptyHint: string;
  signInPolling: boolean;
  onSignIn: (oauthUrl: string) => void;
  onOpenAsNew: (blocks?: SupportedBlock[]) => void;
}) {
  const target = state.kind === 'ready' ? state.target : null;
  const signInUrl =
    state.kind === 'not-editable' && state.oauthUrl && isSafeHref(state.oauthUrl) ? state.oauthUrl : null;
  const verdictBlocks = state.kind === 'not-editable' ? state.blocks : undefined;

  return (
    <div className="flex min-w-0 shrink-0 flex-col gap-2 lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</span>
        {target?.channelName || target?.channelId ? (
          <span className="rounded border px-1.5 py-px text-[10px] font-medium text-muted-foreground">
            {target.channelName ? `#${target.channelName}` : target.channelId}
          </span>
        ) : null}
        {target?.editableVia ? (
          <span className="rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Editable as {editableLabel(target.editableVia)}
          </span>
        ) : null}
      </div>

      {/* Focusable so the pane is scrollable by keyboard: a plain message
          preview holds no controls, so without this there'd be nothing to tab
          to inside it and its overflow would be unreachable. */}
      <div
        role="region"
        aria-label="Message preview"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: axe's scrollable-region-focusable rule wants the opposite — a scroll container whose content isn't focusable must itself be focusable, or keyboard users can't scroll it.
        tabIndex={0}
        className="flex max-h-72 min-h-32 flex-1 flex-col gap-3 overflow-y-auto rounded-md border bg-muted/40 p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:max-h-none lg:min-h-0"
      >
        {state.kind === 'not-editable' && (
          <div className="flex shrink-0 flex-col gap-2 rounded-md border border-amber-200! bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{state.reason}</span>
            </div>
            {/* Sign-in verdict: open OAuth and re-check the load on completion. */}
            {signInUrl && <SlackSignInButton onClick={() => onSignIn(signInUrl)} polling={signInPolling} />}
            {/* Only offer "open as new" when there are blocks to carry over.
                A no-match verdict has none, so there's nothing to open. */}
            {verdictBlocks && verdictBlocks.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onOpenAsNew(verdictBlocks)}
              >
                Open as a new message instead
              </Button>
            )}
          </div>
        )}

        {state.kind === 'error' && (
          <p className="shrink-0 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
            {state.error}
          </p>
        )}

        {state.kind === 'loading' && (
          <p className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Looking up that message…
          </p>
        )}

        {state.kind === 'empty' && <p className="m-auto px-4 text-center text-sm text-muted-foreground">{emptyHint}</p>}

        {/* `shrink-0` on the renders below is load-bearing: the message frame
            clips its own overflow (for the rounded corners), so as a shrinkable
            flex item it would compress to the pane's height and swallow the
            bottom of a long message instead of scrolling it. */}
        {target && (
          <div className="shrink-0">
            <SlackMessagePreview
              blocks={target.blocks}
              hooks={hooks}
              theme={theme}
              workspaceName={target.workspaceName}
              authorName={target.username}
              authorIcon={target.iconUrl}
              time={formatTs(target.ts)}
            />
          </div>
        )}

        {/* A not-editable verdict may still carry blocks (the host uses this to
            seed a draft from a message it can't edit in place), so preview them
            under the reason. */}
        {verdictBlocks && verdictBlocks.length > 0 && (
          <div className="shrink-0">
            <SlackMessagePreview blocks={verdictBlocks} hooks={hooks} theme={theme} time="" />
          </div>
        )}
      </div>
    </div>
  );
}
