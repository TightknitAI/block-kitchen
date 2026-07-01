import { AlertTriangle, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { Button } from '../lib/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/ui/dialog';
import { Input } from '../lib/ui/input';
import { Label } from '../lib/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/ui/tooltip';
import { isSafeImageSrc } from '../lib/url-safety';
import type { ChannelOption, LoadResult, RecentMessage, SupportedBlock } from '../types';

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

type LoadStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | { kind: 'not-editable'; reason: string; blocks?: SupportedBlock[] };

/**
 * Edit-mode entry point. Collects a Slack message permalink and hands it to
 * the host's `onLoadMessage`. On a successful load the parent flips into
 * edit mode (`onLoaded`); on a not-editable verdict the dialog renders the
 * host's `reason` inline and, when that verdict carries blocks, offers
 * "Open as a new message instead" (a no-match verdict has none, so only the
 * reason shows).
 *
 * The package never parses the permalink — the host extracts `channel + ts`.
 * @param props - dialog props
 * @param props.open - whether the dialog is open
 * @param props.onOpenChange - notified when the user closes the dialog
 * @param props.onLoadMessage - host loader returning an editability verdict
 * @param props.loadRecentMessages - optional loader for the "recent messages" picker, scoped to a channel
 * @param props.loadChannels - returns channels to scope the recent-messages picker by
 * @param props.onLoaded - called with the `ok` result so the parent enters edit mode
 * @param props.onOpenAsNew - called with optional blocks for the "open as new" fallback
 * @returns the rendered load-message dialog
 */
export function LoadMessageDialog({
  open,
  onOpenChange,
  onLoadMessage,
  loadRecentMessages,
  loadChannels,
  onLoaded,
  onOpenAsNew
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadMessage: (input: { link: string }) => Promise<LoadResult>;
  loadRecentMessages?: (channelId: string) => Promise<RecentMessage[]>;
  loadChannels: () => Promise<ChannelOption[]>;
  onLoaded: (result: Extract<LoadResult, { ok: true }>) => void;
  onOpenAsNew: (blocks?: SupportedBlock[]) => void;
}) {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<LoadStatus>({ kind: 'idle' });
  // Channel selector for the recent-messages picker (only when `loadRecentMessages`
  // is given). The user must pick a channel before any recent lookup runs.
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string>('');
  // Recent messages for the selected channel. `null` means "loading / not loaded yet".
  const [recent, setRecent] = useState<RecentMessage[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  // The recent-message row the user has picked. The footer "Load message"
  // button loads it; mutually exclusive with the pasted link.
  const [selectedRecent, setSelectedRecent] = useState<RecentMessage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const hasRecent = !!loadRecentMessages;

  // Reset to a clean slate each time the dialog opens, and load the channel
  // list so the user can scope the recent-messages picker.
  useEffect(() => {
    if (!open) {
      return;
    }
    setLink('');
    setStatus({ kind: 'idle' });
    setChannelId('');
    setRecent(null);
    setRecentError(null);
    setSelectedRecent(null);
    if (!loadRecentMessagesRef.current) {
      setChannels([]);
      setChannelsError(null);
      return;
    }
    setChannels(null);
    setChannelsError(null);
    let cancelled = false;
    loadChannelsRef
      .current()
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
  }, [open]);

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

  const handleLoad = async () => {
    // A picked recent message loads directly — it's already fully resolved, so
    // there's no link to fetch.
    if (selectedRecent) {
      onLoaded(recentToResult(selectedRecent));
      return;
    }
    const trimmed = link.trim();
    if (!trimmed) {
      setStatus({ kind: 'error', error: 'Paste a Slack message link first.' });
      return;
    }
    setStatus({ kind: 'loading' });
    try {
      const result = await onLoadMessageRef.current({ link: trimmed });
      if (result.ok) {
        onLoaded(result);
        return;
      }
      setStatus({ kind: 'not-editable', reason: result.reason, blocks: result.blocks });
    } catch (e) {
      setStatus({ kind: 'error', error: e instanceof Error ? e.message : 'Failed to load message.' });
    }
  };

  const notEditable = status.kind === 'not-editable' ? status : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-lg rounded-lg"
        // Focus the link input on open instead of letting Radix focus the
        // first tabbable element (the info button), which would pop its
        // tooltip open every time the dialog appears.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Edit an existing message</DialogTitle>
          <div className="flex items-start gap-1.5 text-left">
            <DialogDescription>
              {hasRecent
                ? 'Paste a Slack message link, or pick a recent message your app posted.'
                : 'Paste a Slack message link (Slack\'s "Copy link") to load its blocks for editing.'}
            </DialogDescription>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="How to copy a message link"
                  className="mt-0.5 shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs leading-relaxed">
                In Slack, hover over the message and click the <strong>⋮ More actions</strong> button (or right-click
                the message), then choose <strong>Copy link</strong>.
              </TooltipContent>
            </Tooltip>
          </div>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message-link">Message link</Label>
            <Input
              ref={inputRef}
              id="message-link"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                // Typing a link takes over from a picked recent message.
                setSelectedRecent(null);
                if (status.kind !== 'idle' && status.kind !== 'loading') {
                  setStatus({ kind: 'idle' });
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && status.kind !== 'loading') {
                  e.preventDefault();
                  handleLoad();
                }
              }}
              placeholder="https://your-workspace.slack.com/archives/C…/p…"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {status.kind === 'error' && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {status.error}
            </p>
          )}

          {notEditable && (
            <div className="flex flex-col gap-2 rounded-md border border-amber-200! bg-amber-50 p-3 text-xs text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{notEditable.reason}</span>
              </div>
              {/* Only offer "open as new" when there are blocks to carry over.
                  A no-match verdict has none, so there's nothing to open. */}
              {notEditable.blocks && notEditable.blocks.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => onOpenAsNew(notEditable.blocks)}
                >
                  Open as a new message instead
                </Button>
              )}
            </div>
          )}

          {hasRecent && (
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or pick a recent message
                <span className="h-px flex-1 bg-border" />
              </div>

              {/* Pick a channel first — the recent lookup is scoped to it. */}
              <div className="flex flex-col gap-1.5">
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
                <p className="text-xs text-muted-foreground">Select a channel to see recent messages.</p>
              )}
              {channelId && recent === null && !recentError && (
                <p className="text-xs text-muted-foreground">Loading recent messages…</p>
              )}
              {channelId && recentError && <p className="text-xs text-destructive">{recentError}</p>}
              {channelId && recent && recent.length === 0 && !recentError && (
                <p className="text-xs text-muted-foreground">No recent messages from this app in this channel.</p>
              )}
              {channelId && recent && recent.length > 0 && (
                <div className="flex max-h-48 min-w-0 flex-col gap-1 overflow-y-auto">
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
                          setLink('');
                          if (status.kind !== 'idle' && status.kind !== 'loading') {
                            setStatus({ kind: 'idle' });
                          }
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
                            {new Date(Number(m.ts) * 1000).toLocaleString()} <span className="font-mono">({m.ts})</span>
                          </span>
                          <span className="line-clamp-2 text-sm text-foreground">{previewText(m)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleLoad}
            disabled={status.kind === 'loading' || (!selectedRecent && !link.trim())}
          >
            {status.kind === 'loading' ? 'Loading…' : 'Load message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
