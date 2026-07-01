import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EditTarget, UpdateDialog } from '../src/components/update-dialog';
import type { SendAsUserStatus, UpdateResult } from '../src/types';

const TARGET: EditTarget = { channelId: 'C1', channelName: 'general', ts: '111.1', editableVia: 'user' };
const noopUpdate = async (): Promise<UpdateResult> => ({ ok: true });

function renderDialog(loadSendAsUserStatus: () => Promise<SendAsUserStatus>) {
  render(
    <UpdateDialog
      open
      onOpenChange={() => {}}
      target={TARGET}
      blocks={[]}
      loadSendAsUserStatus={loadSendAsUserStatus}
      onUpdate={noopUpdate}
      errorCount={0}
    />
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('UpdateDialog Slack sign-in polling', () => {
  it('opens OAuth and unlocks once the token status flips to connected', async () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    let canSend = false;
    const load = vi.fn(
      async (): Promise<SendAsUserStatus> => ({ canSendAsUser: canSend, oauthUrl: 'https://slack.com/oauth' })
    );

    renderDialog(load);
    await act(async () => {}); // flush initial status fetch

    fireEvent.click(screen.getByRole('button', { name: /sign in with slack/i }));
    expect(openSpy).toHaveBeenCalledWith('https://slack.com/oauth', '_blank', 'noopener,noreferrer');
    expect(screen.getByText('Waiting for Slack…')).toBeTruthy();

    canSend = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500); // one poll picks up the change
    });

    expect(screen.queryByText('Connect your Slack account to edit your own messages.')).toBeNull();
  });

  it('stops polling after the retry cap when sign-in never completes', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'open').mockReturnValue(null);
    const load = vi.fn(
      async (): Promise<SendAsUserStatus> => ({ canSendAsUser: false, oauthUrl: 'https://slack.com/oauth' })
    );

    renderDialog(load);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: /sign in with slack/i }));
    await vi.advanceTimersByTimeAsync(2500 * 30); // advance well past the cap

    // 1 initial fetch + 24 capped polls, and no more even after 30 intervals.
    expect(load.mock.calls.length).toBe(25);
    expect(screen.queryByText('Waiting for Slack…')).toBeNull();
  });
});
