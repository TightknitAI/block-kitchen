import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { LoadMessageDialog } from '../src/components/load-message-dialog';
import { TooltipProvider } from '../src/lib/ui/tooltip';
import type { LoadResult, RecentMessage, SupportedBlock } from '../src/types';

const CHANNELS = [
  { id: 'C1', name: 'general' },
  { id: 'C2', name: 'random' }
];

const RECENT_BY_CHANNEL: Record<string, RecentMessage[]> = {
  C1: [{ channelId: 'C1', channelName: 'general', ts: '111.1', blocks: [], label: 'hi general' }],
  C2: [{ channelId: 'C2', channelName: 'random', ts: '222.2', blocks: [], label: 'hi random' }]
};

const noopLoad = async (): Promise<LoadResult> => ({ ok: false, reason: 'nope' });

/** A recent message with real blocks + author metadata, for preview assertions. */
const RECENT_WITH_BLOCKS: RecentMessage = {
  channelId: 'C1',
  channelName: 'general',
  ts: '1699999999.000100',
  blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Deploy finished' } }] as SupportedBlock[],
  label: 'picked row',
  username: 'Ada',
  iconUrl: 'https://example.com/ada.png'
};

/** The verdict a pasted link resolves to in the preview tests. */
const LINK_RESULT: Extract<LoadResult, { ok: true }> = {
  ok: true,
  channelId: 'C2',
  channelName: 'random',
  ts: '1700000042.000200',
  blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Pasted link body' } }] as SupportedBlock[],
  editableVia: 'user',
  username: 'Grace'
};

/** Same formatting the preview header uses, so time assertions survive any TZ. */
function headerTime(ts: string): string {
  return new Date(Number(ts) * 1000).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

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

/** The dialog with only `onLoadMessage` wired — no recent source, so no tabs. */
function renderLinkOnlyDialog(overrides: Partial<Parameters<typeof LoadMessageDialog>[0]> = {}) {
  render(
    <TooltipProvider>
      <LoadMessageDialog
        open
        onOpenChange={() => {}}
        onLoadMessage={noopLoad}
        onLoaded={() => {}}
        onOpenAsNew={() => {}}
        {...overrides}
      />
    </TooltipProvider>
  );
}

/** Switch to the "Direct Link" tab (only present when a recent source is wired). */
async function openLinkTab() {
  fireEvent.click(await screen.findByRole('tab', { name: 'Direct Link' }));
}

/** The right-hand pane, scoped so preview assertions can't match left-pane copy. */
function previewPane(): HTMLElement {
  return screen.getByRole('region', { name: 'Message preview' });
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

    fireEvent.click(screen.getByRole('button', { name: 'Load message' }));
    expect(loaded).toEqual(['111.1']);
  });
});

describe('LoadMessageDialog tabs', () => {
  it('shows both tabs, defaulting to Pick from Recent, when a recent source is wired', async () => {
    renderDialog();
    const tabs = await screen.findAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Pick from Recent', 'Direct Link']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    // The recent panel is the one showing; the link input lives behind the other tab.
    expect(screen.getByLabelText('Channel')).toBeTruthy();
    expect(screen.queryByLabelText('Message link')).toBeNull();

    await openLinkTab();
    expect(screen.getByLabelText('Message link')).toBeTruthy();
    expect(screen.queryByLabelText('Channel')).toBeNull();
  });

  it('renders the link pane alone — with no tab strip — when only onLoadMessage is wired', () => {
    renderLinkOnlyDialog();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByLabelText('Message link')).toBeTruthy();
    expect(
      screen.getByText(
        'Click the ⠇menu while hovering over the message in Slack (or right-click), and select "Copy Link". Paste here.'
      )
    ).toBeTruthy();
  });

  it('moves selection and focus with the arrow keys', async () => {
    renderDialog();
    const [recentTab, linkTab] = await screen.findAllByRole('tab');
    // Roving tabindex: only the selected tab is in the tab order.
    expect(recentTab.getAttribute('tabindex')).toBe('0');
    expect(linkTab.getAttribute('tabindex')).toBe('-1');

    fireEvent.keyDown(recentTab, { key: 'ArrowRight' });
    expect(linkTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(linkTab);
    expect(screen.getByLabelText('Message link')).toBeTruthy();

    // Wraps back around to the first tab.
    fireEvent.keyDown(linkTab, { key: 'ArrowRight' });
    expect(recentTab.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(recentTab);
  });

  it('wires each panel to its tab for screen readers', async () => {
    renderDialog();
    const [recentTab] = await screen.findAllByRole('tab');
    const panel = screen.getByRole('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe(recentTab.id);
    expect(recentTab.getAttribute('aria-controls')).toBe(panel.id);
  });
});

describe('LoadMessageDialog preview pane', () => {
  it('previews the highlighted recent message, sender and time included', async () => {
    renderDialog({ loadRecentMessages: async () => [RECENT_WITH_BLOCKS] });
    fireEvent.change(await screen.findByLabelText('Channel'), { target: { value: 'C1' } });

    // Muted empty state until something is picked.
    expect(within(previewPane()).getByText('Select a recent message to preview it here.')).toBeTruthy();

    fireEvent.click((await screen.findByText('picked row')).closest('button') as HTMLButtonElement);

    const pane = previewPane();
    expect(within(pane).getByText('Deploy finished')).toBeTruthy();
    expect(within(pane).getByText('Ada')).toBeTruthy();
    expect(within(pane).getByText(headerTime(RECENT_WITH_BLOCKS.ts))).toBeTruthy();
    expect(pane.querySelector('img[src="https://example.com/ada.png"]')).toBeTruthy();
    expect(within(pane).queryByText('Select a recent message to preview it here.')).toBeNull();
  });

  it('previews a pasted link once typing settles, without loading it', async () => {
    const calls: string[] = [];
    const loaded: string[] = [];
    renderDialog({
      onLoadMessage: async ({ link }) => {
        calls.push(link);
        return LINK_RESULT;
      },
      onLoaded: (r) => loaded.push(r.ts)
    });
    await openLinkTab();

    const input = screen.getByLabelText('Message link');
    fireEvent.change(input, { target: { value: 'https://x.slack.com/archives/C1/p' } });
    fireEvent.change(input, { target: { value: 'https://x.slack.com/archives/C1/p17' } });
    // Debounced: typing alone never reaches the host.
    expect(calls).toEqual([]);

    // ...but the link resolves on its own once typing stops.
    await screen.findByText('Pasted link body');
    expect(calls).toEqual(['https://x.slack.com/archives/C1/p17']);
    const pane = previewPane();
    expect(within(pane).getByText('Grace')).toBeTruthy();
    expect(within(pane).getByText(headerTime(LINK_RESULT.ts))).toBeTruthy();

    // Previewing is not loading — that still takes the footer button, which
    // reuses the verdict the preview already fetched.
    expect(loaded).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Load message' }));
    expect(loaded).toEqual([LINK_RESULT.ts]);
    expect(calls).toHaveLength(1);
  });

  it('resets the preview to the active tab’s own selection when tabs change', async () => {
    renderDialog({ loadRecentMessages: async () => [RECENT_WITH_BLOCKS], onLoadMessage: async () => LINK_RESULT });
    fireEvent.change(await screen.findByLabelText('Channel'), { target: { value: 'C1' } });
    fireEvent.click((await screen.findByText('picked row')).closest('button') as HTMLButtonElement);
    expect(within(previewPane()).getByText('Deploy finished')).toBeTruthy();

    // Nothing pasted yet on the link tab, so its preview starts empty.
    await openLinkTab();
    expect(within(previewPane()).getByText('Paste a message link to preview it here.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Message link'), {
      target: { value: 'https://x.slack.com/archives/C1/p1' }
    });
    await screen.findByText('Pasted link body');

    // Back to Recent: the row picked earlier is what's previewed again.
    fireEvent.click(screen.getByRole('tab', { name: 'Pick from Recent' }));
    expect(within(previewPane()).getByText('Deploy finished')).toBeTruthy();
    expect(within(previewPane()).queryByText('Pasted link body')).toBeNull();

    // ...and the link tab still holds its own resolved message.
    await openLinkTab();
    expect(within(previewPane()).getByText('Pasted link body')).toBeTruthy();
  });

  it("renders the preview in the builder's theme", async () => {
    renderDialog({ loadRecentMessages: async () => [RECENT_WITH_BLOCKS], previewTheme: 'dark' });
    fireEvent.change(await screen.findByLabelText('Channel'), { target: { value: 'C1' } });
    fireEvent.click((await screen.findByText('picked row')).closest('button') as HTMLButtonElement);
    // The block renderer is the builder's own, so the theme it was handed is
    // what `slack-blocks-to-jsx` styles against.
    expect(previewPane().querySelector('[data-theme="dark"]')).toBeTruthy();
  });

  it('previews the blocks carried by a not-editable verdict alongside the reason', async () => {
    renderLinkOnlyDialog({
      onLoadMessage: async () => ({
        ok: false,
        reason: "Can't edit this one.",
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: 'Someone else’s message' } }] as SupportedBlock[]
      })
    });
    fireEvent.change(screen.getByLabelText('Message link'), {
      target: { value: 'https://x.slack.com/archives/C1/p1' }
    });

    const reason = await screen.findByText("Can't edit this one.");
    const pane = previewPane();
    expect(pane.contains(reason)).toBe(true);
    expect(within(pane).getByText('Someone else’s message')).toBeTruthy();
    expect(within(pane).getByRole('button', { name: 'Open as a new message instead' })).toBeTruthy();
  });
});

describe('LoadMessageDialog not-editable verdict', () => {
  async function loadViaLink(onLoadMessage: () => Promise<LoadResult>) {
    renderDialog({ onLoadMessage });
    await openLinkTab();
    fireEvent.change(await screen.findByLabelText('Message link'), {
      target: { value: 'https://x.slack.com/archives/C1/p1' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load message' }));
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

  it('keeps the link controls usable while the preview shows the failure', async () => {
    await loadViaLink(async () => ({ ok: false, reason: 'No message matched that link.' }));
    // The verdict lands in the preview pane...
    expect(within(await screen.findByRole('region', { name: 'Message preview' })).getByText(/No message matched/));
    // ...and the left pane still holds the link the user typed, ready to fix.
    expect((screen.getByLabelText('Message link') as HTMLInputElement).value).toBe(
      'https://x.slack.com/archives/C1/p1'
    );
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
    fireEvent.click(screen.getByRole('tab', { name: 'Direct Link' }));
    fireEvent.change(screen.getByLabelText('Message link'), {
      target: { value: 'https://x.slack.com/archives/C1/p1' }
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Load message' }));
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
