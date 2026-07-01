import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { LoadMessageDialog } from '../src/components/load-message-dialog';
import { TooltipProvider } from '../src/lib/ui/tooltip';
import type { LoadResult, RecentMessage } from '../src/types';

const CHANNELS = [
  { id: 'C1', name: 'general' },
  { id: 'C2', name: 'random' }
];

const RECENT_BY_CHANNEL: Record<string, RecentMessage[]> = {
  C1: [{ channelId: 'C1', channelName: 'general', ts: '111.1', blocks: [], label: 'hi general' }],
  C2: [{ channelId: 'C2', channelName: 'random', ts: '222.2', blocks: [], label: 'hi random' }]
};

const noopLoad = async (): Promise<LoadResult> => ({ ok: false, reason: 'nope' });

function renderDialog(overrides: Partial<Parameters<typeof LoadMessageDialog>[0]> = {}): {
  loadRecentMessages: (channelId: string) => Promise<RecentMessage[]>;
} {
  const loadRecentMessages = overrides.loadRecentMessages ?? (async (id: string) => RECENT_BY_CHANNEL[id] ?? []);
  render(
    <TooltipProvider>
      <LoadMessageDialog
        open
        onOpenChange={() => {}}
        onLoadMessage={noopLoad}
        loadChannels={async () => CHANNELS}
        loadRecentMessages={loadRecentMessages}
        onLoaded={() => {}}
        onOpenAsNew={() => {}}
        {...overrides}
      />
    </TooltipProvider>
  );
  return { loadRecentMessages };
}

describe('LoadMessageDialog recent-messages picker', () => {
  it('requires a channel selection before listing recent messages', async () => {
    const calls: string[] = [];
    renderDialog({
      loadRecentMessages: async (id) => {
        calls.push(id);
        return RECENT_BY_CHANNEL[id] ?? [];
      }
    });

    // Channel picker shows once channels resolve; nothing fetched yet.
    await screen.findByText('Select a channel to see recent messages.');
    expect(calls).toEqual([]);

    // Picking a channel scopes the lookup to it.
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'C1' } });
    await screen.findByText('hi general');
    expect(calls).toEqual(['C1']);
    expect(screen.queryByText('hi random')).toBeNull();

    // Changing the channel re-fetches for the new channel only.
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'C2' } });
    await screen.findByText('hi random');
    expect(calls).toEqual(['C1', 'C2']);
  });

  it('renders an empty state when the channel has no editable messages', async () => {
    renderDialog({ loadRecentMessages: async () => [] });
    fireEvent.change(await screen.findByLabelText('Channel'), { target: { value: 'C1' } });
    await screen.findByText('No recent messages from this app in this channel.');
  });

  it('renders an error state when the loader throws', async () => {
    renderDialog({
      loadRecentMessages: async () => {
        throw new Error('boom');
      }
    });
    fireEvent.change(await screen.findByLabelText('Channel'), { target: { value: 'C1' } });
    await screen.findByText('boom');
  });

  it('selects a recent message on click and loads it via the footer button', async () => {
    const loaded: string[] = [];
    renderDialog({ onLoaded: (r) => loaded.push(r.ts) });

    fireEvent.change(await screen.findByLabelText('Channel'), { target: { value: 'C1' } });
    const row = (await screen.findByText('hi general')).closest('button') as HTMLButtonElement;

    // Clicking a row only selects it — the load happens on the footer button.
    fireEvent.click(row);
    expect(loaded).toEqual([]);
    expect(row.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Find message' }));
    expect(loaded).toEqual(['111.1']);
  });
});

describe('LoadMessageDialog not-editable verdict', () => {
  async function loadViaLink(onLoadMessage: () => Promise<LoadResult>) {
    renderDialog({ onLoadMessage });
    fireEvent.change(await screen.findByLabelText('Message link'), {
      target: { value: 'https://x.slack.com/archives/C1/p1' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Find message' }));
  }

  it('shows only the reason (no "open as new") when the verdict carries no blocks', async () => {
    await loadViaLink(async () => ({ ok: false, reason: 'No message matched that link.' }));
    await screen.findByText('No message matched that link.');
    expect(screen.queryByRole('button', { name: 'Open as a new message instead' })).toBeNull();
  });

  it('offers "open as new" when the verdict carries blocks', async () => {
    await loadViaLink(async () => ({ ok: false, reason: "Can't edit this one.", blocks: [{ type: 'divider' }] }));
    await screen.findByRole('button', { name: 'Open as a new message instead' });
  });
});

describe('LoadMessageDialog sign-in verdict', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function pasteAndFind(onLoadMessage: () => Promise<LoadResult>, onLoaded: (r: LoadResult) => void) {
    renderDialog({ onLoadMessage, onLoaded: onLoaded as never });
    await act(async () => {}); // flush the open effect
    fireEvent.change(screen.getByLabelText('Message link'), {
      target: { value: 'https://x.slack.com/archives/C1/p1' }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Find message' }));
    });
  }

  it('opens OAuth and enters edit mode once the load becomes editable', async () => {
    vi.useFakeTimers();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    let editable = false;
    const loaded: LoadResult[] = [];
    const onLoadMessage = async (): Promise<LoadResult> =>
      editable
        ? { ok: true, channelId: 'C1', ts: '1.1', blocks: [], editableVia: 'user' }
        : {
            ok: false,
            reason: 'Connect your Slack account to edit your own messages.',
            oauthUrl: 'https://slack.com/oauth',
            blocks: [{ type: 'divider' }]
          };

    await pasteAndFind(onLoadMessage, (r) => loaded.push(r));

    fireEvent.click(screen.getByRole('button', { name: /sign in with slack/i }));
    expect(openSpy).toHaveBeenCalledWith('https://slack.com/oauth', '_blank', 'noopener,noreferrer');
    expect(screen.getByText('Waiting for Slack…')).toBeTruthy();

    editable = true; // sign-in "completes"
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(loaded).toHaveLength(1);
  });

  it('stops re-checking after the retry cap when sign-in never completes', async () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'open').mockReturnValue(null);
    let calls = 0;
    const loaded: LoadResult[] = [];
    const onLoadMessage = async (): Promise<LoadResult> => {
      calls += 1;
      return {
        ok: false,
        reason: 'Connect your Slack account to edit your own messages.',
        oauthUrl: 'https://slack.com/oauth'
      };
    };

    await pasteAndFind(onLoadMessage, (r) => loaded.push(r));
    const afterFind = calls; // the initial find call

    fireEvent.click(screen.getByRole('button', { name: /sign in with slack/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500 * 30); // well past the cap
    });

    expect(calls).toBe(afterFind + 24); // 24 capped re-checks, then it stops
    expect(loaded).toHaveLength(0);
    expect(screen.queryByText('Waiting for Slack…')).toBeNull();
  });
});
