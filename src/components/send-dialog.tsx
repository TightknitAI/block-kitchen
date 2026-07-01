import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toSlackBlocks } from '../lib/to-slack-blocks';
import { Button } from '../lib/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/ui/dialog';
import { Label } from '../lib/ui/label';
import { isSafeHref } from '../lib/url-safety';
import type { ChannelOption, SendAsUserStatus, SendPayload, SupportedBlock } from '../types';
import { SlackSignInButton, useSlackSignIn } from './slack-sign-in';

type SendStatus = { kind: 'idle' } | { kind: 'sending' } | { kind: 'success' } | { kind: 'error'; error: string };

/**
 * Modal dialog that collects the destination channel + send-as identity,
 * then calls the consumer's `onSend`.
 *
 * Channels and user-token status are loaded async via callback props on open.
 * The consumer brokers all I/O; the dialog never makes a network call.
 * @param props - dialog props
 * @param props.open - whether the dialog is open
 * @param props.onOpenChange - notified when the user closes the dialog
 * @param props.blocks - the draft blocks to send
 * @param props.loadChannels - returns channels available to send to
 * @param props.loadSendAsUserStatus - returns user-token status + OAuth URL
 * @param props.onSend - terminal action; should return `{ ok }` or `{ ok: false, error }`
 * @param props.confirmSendLabel - label for the final confirm button. Defaults to `'Send'`.
 * @param props.errorCount - total validation errors against the current draft
 * @param props.onShowIssues - called when the user opens the global issues panel
 * @returns the rendered send dialog
 */
export function SendDialog({
  open,
  onOpenChange,
  blocks,
  loadChannels,
  loadSendAsUserStatus,
  onSend,
  confirmSendLabel = 'Send',
  errorCount,
  onShowIssues
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: SupportedBlock[];
  loadChannels: () => Promise<ChannelOption[]>;
  loadSendAsUserStatus: () => Promise<SendAsUserStatus>;
  onSend: (payload: SendPayload) => Promise<{ ok: boolean; error?: string }>;
  /** Label for the final confirm button. Defaults to `'Send'`. */
  confirmSendLabel?: string;
  /** Total validation errors against the current draft. */
  errorCount: number;
  /** Asks the parent to open the global issues panel. */
  onShowIssues?: () => void;
}) {
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string>('');
  const [sendAs, setSendAs] = useState<'bot' | 'user'>('bot');
  const [status, setStatus] = useState<SendStatus>({ kind: 'idle' });

  const { userStatus, polling, startSignIn } = useSlackSignIn(loadSendAsUserStatus, { open, enabled: true });

  // Hold the latest channels loader in a ref so the open effect can depend only
  // on `open` without retriggering when the consumer passes a fresh arrow
  // function each render.
  const loadChannelsRef = useRef(loadChannels);
  useEffect(() => {
    loadChannelsRef.current = loadChannels;
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    setStatus({ kind: 'idle' });
    setChannels(null);
    setChannelsError(null);
    setChannelId('');
    setSendAs('bot');
    let cancelled = false;
    loadChannelsRef
      .current()
      .then((list) => {
        if (cancelled) {
          return;
        }
        setChannels(list);
        setChannelId(list[0]?.id ?? '');
      })
      .catch((e) => {
        if (cancelled) {
          return;
        }
        setChannelsError(e instanceof Error ? e.message : 'Failed to load channels');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async () => {
    if (!channelId) {
      setStatus({ kind: 'error', error: 'Please pick a channel.' });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      const result = await onSend({
        channelId,
        blocks: toSlackBlocks(blocks),
        sendAsUser: sendAs === 'user'
      });
      if (result.ok) {
        setStatus({ kind: 'idle' });
        onOpenChange(false);
        return;
      } else {
        setStatus({
          kind: 'error',
          error: result.error ?? 'Send failed.'
        });
      }
    } catch (e) {
      setStatus({
        kind: 'error',
        error: e instanceof Error ? e.message : 'Send failed.'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg rounded-lg">
        <DialogHeader>
          <DialogTitle>Send to Slack</DialogTitle>
          <DialogDescription>Pick a channel and choose who to post as.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="send-as-picker">Post as</Label>
            <select
              id="send-as-picker"
              value={sendAs}
              onChange={(e) => setSendAs(e.target.value as 'bot' | 'user')}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="bot">App bot</option>
              <option value="user" disabled={!userStatus?.canSendAsUser}>
                Your account
                {userStatus && !userStatus.canSendAsUser ? ' (Slack sign-in required)' : ''}
              </option>
            </select>
            {userStatus && !userStatus.canSendAsUser && userStatus.oauthUrl && isSafeHref(userStatus.oauthUrl) && (
              <>
                <p className="text-xs text-muted-foreground">Connect your Slack account to post as yourself.</p>
                <SlackSignInButton onClick={startSignIn} polling={polling} />
              </>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="channel-picker">Channel</Label>
            {channels === null && !channelsError && <p className="text-xs text-muted-foreground">Loading channels…</p>}
            {channelsError && <p className="text-xs text-destructive">{channelsError}</p>}
            {channels && channels.length === 0 && (
              <p className="text-xs text-muted-foreground">No public channels available.</p>
            )}
            {channels && channels.length > 0 && (
              <select
                id="channel-picker"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {errorCount > 0 ? (
            <button
              type="button"
              onClick={onShowIssues}
              className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-left text-xs text-destructive hover:bg-destructive/10"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">
                Fix {errorCount} {errorCount === 1 ? 'issue' : 'issues'} before sending.
              </span>
              <span className="shrink-0 underline">Show issues</span>
            </button>
          ) : null}

          {status.kind === 'error' && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {status.error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={status.kind === 'sending' || !channelId || blocks.length === 0 || errorCount > 0}
          >
            {status.kind === 'sending' ? 'Sending…' : confirmSendLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
