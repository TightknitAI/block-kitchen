import { fireEvent, render, screen } from '@testing-library/react';
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
});
