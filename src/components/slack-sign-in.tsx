import { ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../lib/ui/button';
import { isSafeHref } from '../lib/url-safety';
import type { SendAsUserStatus } from '../types';

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 24; // ~1 minute before giving up

/**
 * Tracks the "act as the user" Slack token status for a dialog and drives the
 * OAuth sign-in flow. Shared by {@link SendDialog} and {@link UpdateDialog}.
 *
 * While `open && enabled` it fetches status on open and refreshes on window
 * focus. Once `startSignIn` opens the OAuth tab it also background-polls until
 * the token appears or the retry cap is hit, so the dialog unlocks itself
 * without a manual reload. All work stops when the dialog closes, the token
 * path doesn't apply, or the component unmounts.
 *
 * @param loadStatus - consumer callback returning user-token status + OAuth URL
 * @param options.open - whether the host dialog is open
 * @param options.enabled - whether the user-token path applies (idle when false)
 * @returns `{ userStatus, polling, startSignIn }`
 */
export function useSlackSignIn(
  loadStatus: () => Promise<SendAsUserStatus>,
  { open, enabled }: { open: boolean; enabled: boolean }
) {
  const [userStatus, setUserStatus] = useState<SendAsUserStatus | null>(null);
  const [polling, setPolling] = useState(false);

  // Hold the latest loader in a ref so effects depend only on open/enabled and
  // don't retrigger when the consumer passes a fresh arrow function each render.
  const loadStatusRef = useRef(loadStatus);
  useEffect(() => {
    loadStatusRef.current = loadStatus;
  });

  const refresh = useCallback(() => {
    loadStatusRef
      .current()
      .then(setUserStatus)
      .catch(() => setUserStatus({ canSendAsUser: false }));
  }, []);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  const startSignIn = useCallback(() => {
    const url = userStatus?.oauthUrl;
    if (!url || !isSafeHref(url)) {
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    stopPolling();
    setPolling(true);
    let tries = 0;
    pollRef.current = setInterval(() => {
      tries += 1;
      loadStatusRef
        .current()
        .then((next) => {
          setUserStatus(next);
          if (next.canSendAsUser) {
            stopPolling();
          }
        })
        .catch(() => {})
        .finally(() => {
          if (tries >= MAX_POLLS) {
            stopPolling();
          }
        });
    }, POLL_INTERVAL_MS);
  }, [userStatus, stopPolling]);

  // Fetch on open; clear and stop polling when the dialog closes, the token path
  // doesn't apply, or the component unmounts.
  useEffect(() => {
    if (!open || !enabled) {
      setUserStatus(null);
      stopPolling();
      return;
    }
    setUserStatus(null);
    refresh();
    return stopPolling;
  }, [open, enabled, refresh, stopPolling]);

  // Pick up a completed OAuth round-trip when the window regains focus.
  useEffect(() => {
    if (!open || !enabled) {
      return;
    }
    const handler = () => refresh();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [open, enabled, refresh]);

  return { userStatus, polling, startSignIn };
}

/**
 * The "Sign in with Slack" button used by both dialogs. Opens OAuth and shows a
 * spinner while {@link useSlackSignIn} polls for the completed round-trip. The
 * surrounding explanatory copy stays with each caller since it differs.
 * @param props.onClick - starts the sign-in flow (typically `startSignIn`)
 * @param props.polling - whether a background poll is in flight
 */
export function SlackSignInButton({ onClick, polling }: { onClick: () => void; polling: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={onClick} disabled={polling}>
      {polling ? (
        <>
          <Loader2 className="animate-spin" /> Waiting for Slack…
        </>
      ) : (
        <>
          Sign in with Slack <ExternalLink />
        </>
      )}
    </Button>
  );
}
