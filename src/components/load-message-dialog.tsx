import { AlertTriangle, Info } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../lib/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/ui/dialog';
import { Input } from '../lib/ui/input';
import { Label } from '../lib/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '../lib/ui/tooltip';
import type { LoadResult, RecentMessage, SupportedBlock } from '../types';

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

type LoadStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; error: string }
  | { kind: 'not-editable'; reason: string; blocks?: SupportedBlock[] };

/**
 * Edit-mode entry point. Collects a Slack message permalink and hands it to
 * the host's `onLoadMessage`. On a successful load the parent flips into
 * edit mode (`onLoaded`); on a not-editable verdict the dialog renders the
 * host's `reason` inline and offers "Open as a new message instead".
 *
 * The package never parses the permalink — the host extracts `channel + ts`.
 * @param props - dialog props
 * @param props.open - whether the dialog is open
 * @param props.onOpenChange - notified when the user closes the dialog
 * @param props.onLoadMessage - host loader returning an editability verdict
 * @param props.loadRecentMessages - optional loader for the "recent messages" picker
 * @param props.onLoaded - called with the `ok` result so the parent enters edit mode
 * @param props.onOpenAsNew - called with optional blocks for the "open as new" fallback
 * @returns the rendered load-message dialog
 */
export function LoadMessageDialog({
  open,
  onOpenChange,
  onLoadMessage,
  loadRecentMessages,
  onLoaded,
  onOpenAsNew
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadMessage: (input: { link: string }) => Promise<LoadResult>;
  loadRecentMessages?: () => Promise<RecentMessage[]>;
  onLoaded: (result: Extract<LoadResult, { ok: true }>) => void;
  onOpenAsNew: (blocks?: SupportedBlock[]) => void;
}) {
  const [link, setLink] = useState('');
  const [status, setStatus] = useState<LoadStatus>({ kind: 'idle' });
  // Recent-messages picker (only loaded when `loadRecentMessages` is given).
  // `null` means "loading / not loaded yet".
  const [recent, setRecent] = useState<RecentMessage[] | null>(null);
  const [recentError, setRecentError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Hold the latest loaders in refs so they can change identity between renders
  // (consumers often pass a fresh arrow) without us needing them as deps.
  const onLoadMessageRef = useRef(onLoadMessage);
  const loadRecentMessagesRef = useRef(loadRecentMessages);
  useEffect(() => {
    onLoadMessageRef.current = onLoadMessage;
    loadRecentMessagesRef.current = loadRecentMessages;
  });

  const hasRecent = !!loadRecentMessages;

  // Reset to a clean slate each time the dialog opens, and (re)load the recent
  // list so a fresh open reflects any messages posted since.
  useEffect(() => {
    if (!open) {
      return;
    }
    setLink('');
    setStatus({ kind: 'idle' });
    if (!loadRecentMessagesRef.current) {
      setRecent([]);
      setRecentError(null);
      return;
    }
    setRecent(null);
    setRecentError(null);
    let cancelled = false;
    loadRecentMessagesRef
      .current()
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
  }, [open]);

  const handleLoad = async () => {
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
          <div className="flex items-start gap-1.5">
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

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message-link">Message link</Label>
            <Input
              ref={inputRef}
              id="message-link"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => onOpenAsNew(notEditable.blocks)}
              >
                Open as a new message instead
              </Button>
            </div>
          )}

          {hasRecent && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or pick a recent message
                <span className="h-px flex-1 bg-border" />
              </div>
              {recent === null && !recentError && (
                <p className="text-xs text-muted-foreground">Loading recent messages…</p>
              )}
              {recentError && <p className="text-xs text-destructive">{recentError}</p>}
              {recent && recent.length === 0 && !recentError && (
                <p className="text-xs text-muted-foreground">No recent messages from this app.</p>
              )}
              {recent && recent.length > 0 && (
                <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {recent.map((m) => {
                    // Which identity the message was posted as — drives both
                    // this badge and (on load) the token the update uses.
                    const asUser = (m.editableVia ?? 'bot') === 'user';
                    return (
                      <button
                        key={`${m.channelId}:${m.ts}`}
                        type="button"
                        onClick={() => onLoaded(recentToResult(m))}
                        className="flex flex-col gap-0.5 rounded-md border border-input bg-background px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="truncate font-medium">
                              {m.channelName ? `#${m.channelName}` : m.channelId}
                            </span>
                            <span className="shrink-0 rounded border px-1 py-px text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {asUser ? 'You' : 'Bot'}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-xs text-muted-foreground">{m.ts}</span>
                        </span>
                        {m.label && <span className="truncate text-xs text-muted-foreground">{m.label}</span>}
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
          <Button type="button" onClick={handleLoad} disabled={status.kind === 'loading' || !link.trim()}>
            {status.kind === 'loading' ? 'Loading…' : 'Load message'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
