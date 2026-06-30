import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toSlackBlocks } from '../lib/to-slack-blocks';
import { Button } from '../lib/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../lib/ui/dialog';
import { Label } from '../lib/ui/label';
import { isSafeHref } from '../lib/url-safety';
import type { EditableVia, SendAsUserStatus, SupportedBlock, UpdatePayload, UpdateResult } from '../types';

/** The loaded message being edited. Destination + identity are fixed by the host's verdict. */
export interface EditTarget {
  channelId: string;
  channelName?: string;
  ts: string;
  editableVia: EditableVia;
  workspaceName?: string;
  username?: string;
  iconUrl?: string;
}

type UpdateStatus = { kind: 'idle' } | { kind: 'updating' } | { kind: 'error'; error: string };

/**
 * Modal dialog confirming an update to an already-posted message. Unlike the
 * send dialog, the destination channel is locked to the source and the
 * post-as identity is fixed by the host's `editableVia` verdict — there is no
 * channel or identity picker. When the verdict is `'user'` and the user has no
 * token yet, the dialog reuses the "Sign in with Slack" flow before allowing
 * the update.
 * @param props - dialog props
 * @param props.open - whether the dialog is open
 * @param props.onOpenChange - notified when the user closes the dialog
 * @param props.target - the loaded message (channel + ts + editability verdict)
 * @param props.blocks - the edited draft blocks to write back
 * @param props.loadSendAsUserStatus - returns user-token status + OAuth URL (user-token path only)
 * @param props.onUpdate - terminal action; should return `{ ok }` or `{ ok: false, error }`
 * @param props.confirmUpdateLabel - label for the confirm button. Defaults to `'Update message'`.
 * @param props.errorCount - total validation errors against the current draft
 * @param props.onShowIssues - called when the user opens the global issues panel
 * @returns the rendered update dialog
 */
export function UpdateDialog({
  open,
  onOpenChange,
  target,
  blocks,
  loadSendAsUserStatus,
  onUpdate,
  confirmUpdateLabel = 'Update message',
  errorCount,
  onShowIssues
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: EditTarget;
  blocks: SupportedBlock[];
  loadSendAsUserStatus: () => Promise<SendAsUserStatus>;
  onUpdate: (payload: UpdatePayload) => Promise<UpdateResult>;
  confirmUpdateLabel?: string;
  errorCount: number;
  onShowIssues?: () => void;
}) {
  const asUser = target.editableVia === 'user';
  const [userStatus, setUserStatus] = useState<SendAsUserStatus | null>(null);
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'idle' });

  const loadSendAsUserStatusRef = useRef(loadSendAsUserStatus);
  useEffect(() => {
    loadSendAsUserStatusRef.current = loadSendAsUserStatus;
  });

  const refreshSendAsUser = useCallback(() => {
    loadSendAsUserStatusRef
      .current()
      .then(setUserStatus)
      .catch(() => setUserStatus({ canSendAsUser: false }));
  }, []);

  // Only the user-token path needs a token check; the bot path can always edit
  // its own message.
  useEffect(() => {
    if (!open) {
      return;
    }
    setStatus({ kind: 'idle' });
    if (asUser) {
      setUserStatus(null);
      refreshSendAsUser();
    }
  }, [open, asUser, refreshSendAsUser]);

  // Pick up a completed OAuth round-trip when the window regains focus.
  useEffect(() => {
    if (!open || !asUser) {
      return;
    }
    const handler = () => refreshSendAsUser();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [open, asUser, refreshSendAsUser]);

  // Editing as the user requires a usable user token. The bot path never gates.
  const needsSignIn = asUser && userStatus !== null && !userStatus.canSendAsUser;

  const handleSubmit = async () => {
    setStatus({ kind: 'updating' });
    try {
      const result = await onUpdate({
        channelId: target.channelId,
        ts: target.ts,
        blocks: toSlackBlocks(blocks),
        asUser
      });
      if (result.ok) {
        setStatus({ kind: 'idle' });
        onOpenChange(false);
        return;
      }
      setStatus({ kind: 'error', error: result.error ?? 'Update failed.' });
    } catch (e) {
      setStatus({ kind: 'error', error: e instanceof Error ? e.message : 'Update failed.' });
    }
  };

  const channelLabel = target.channelName ? `#${target.channelName}` : target.channelId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg rounded-lg">
        <DialogHeader>
          <DialogTitle>Update message</DialogTitle>
          <DialogDescription>
            This replaces the message that's already posted. It stays in the same channel and can't be moved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Channel</Label>
            <p className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {channelLabel}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Posting as</Label>
            <p className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {asUser ? 'Your account' : 'App bot'}
            </p>
            {needsSignIn && userStatus?.oauthUrl && isSafeHref(userStatus.oauthUrl) && (
              <p className="text-xs text-muted-foreground">
                <a
                  href={userStatus.oauthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Sign in with Slack <ExternalLink className="h-3 w-3" />
                </a>{' '}
                to update your own message.
              </p>
            )}
            {needsSignIn && !userStatus?.oauthUrl && (
              <p className="text-xs text-muted-foreground">Sign in with Slack to update your own message.</p>
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
                Fix {errorCount} {errorCount === 1 ? 'issue' : 'issues'} before updating.
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
            disabled={status.kind === 'updating' || blocks.length === 0 || errorCount > 0 || needsSignIn}
          >
            {status.kind === 'updating' ? 'Updating…' : confirmUpdateLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
