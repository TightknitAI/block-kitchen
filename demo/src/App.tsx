import {
  BlockKitchen,
  type BrandPreset,
  type ChannelOption,
  type LoadMessageInput,
  type LoadResult,
  type RecentMessage,
  type SendAsUserStatus,
  type SendPayload,
  type SendResult,
  type SupportedBlock,
  type Template,
  TemplatePicker,
  type UpdatePayload,
  type UpdateResult
} from '@tightknitai/block-kitchen';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { demoTemplates } from './templates';

const PRESET_OPTIONS: { value: BrandPreset; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'slack', label: 'Slack' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'mono', label: 'Mono' },
  { value: 'cyberpunk', label: 'Cyberpunk' }
];

const MOCK_CHANNELS: ChannelOption[] = [
  { id: 'C0001', name: 'general' },
  { id: 'C0002', name: 'random' },
  { id: 'C0003', name: 'engineering' },
  { id: 'C0004', name: 'design' },
  { id: 'C0005', name: 'product' }
];

// --- Edit-mode demo: in-memory "already-posted" message store ---------------
//
// Everything below mocks the host side of the package's opt-in edit mode so
// every editability branch is demonstrable with no backend. A real host would
// parse the pasted permalink, call `conversations.replies`, and compute the
// same verdict; here we look the message up in this store instead.

type MessageAuthor = 'bot' | 'you' | 'someoneElse';

interface StoredMessage {
  ts: string;
  channelId: string;
  channelName: string;
  author: MessageAuthor;
  // `non-block` / `edit-window-closed` reproduce the "sharp edges": a message
  // that doesn't round-trip through the editor, or one past Slack's edit window.
  kind: 'normal' | 'non-block' | 'edit-window-closed';
  blocks: SupportedBlock[];
}

const WORKSPACE_NAME = 'Acme Inc.';

// Slack's "Copy link" permalink shape: …/archives/<channel>/p<ts-without-dot>.
function permalinkFor(msg: Pick<StoredMessage, 'channelId' | 'ts'>): string {
  return `https://acme.slack.com/archives/${msg.channelId}/p${msg.ts.replace('.', '')}`;
}

// Best-effort one-line preview for the recent-messages picker: first block
// that carries text wins.
function previewOf(blocks: SupportedBlock[]): string {
  for (const b of blocks) {
    if ((b.type === 'header' || b.type === 'section') && 'text' in b && b.text && 'text' in b.text) {
      return b.text.text;
    }
  }
  return `${blocks.length} block${blocks.length === 1 ? '' : 's'}`;
}

function sampleBlocks(text: string): SupportedBlock[] {
  return [
    { type: 'header', text: { type: 'plain_text', text } },
    { type: 'section', text: { type: 'mrkdwn', text: `Loaded from the store at *${text}*. Edit me and update.` } }
  ];
}

// One fixture per outcome the verdict logic can produce.
const SEED_MESSAGES: StoredMessage[] = [
  {
    ts: '1718000042.000100',
    channelId: 'C0003',
    channelName: 'engineering',
    author: 'bot',
    kind: 'normal',
    blocks: sampleBlocks('Bot message')
  },
  {
    ts: '1718000099.000200',
    channelId: 'C0001',
    channelName: 'general',
    author: 'you',
    kind: 'normal',
    blocks: sampleBlocks('Your message')
  },
  {
    ts: '1718000150.000300',
    channelId: 'C0002',
    channelName: 'random',
    author: 'someoneElse',
    kind: 'normal',
    blocks: sampleBlocks("Someone else's message")
  },
  {
    ts: '1718000200.000400',
    channelId: 'C0004',
    channelName: 'design',
    author: 'bot',
    kind: 'non-block',
    blocks: []
  },
  {
    ts: '1718000250.000500',
    channelId: 'C0005',
    channelName: 'product',
    author: 'you',
    kind: 'edit-window-closed',
    blocks: sampleBlocks('Old message')
  }
];

// Match a pasted permalink to a stored message. Tolerant of extra query/thread
// params: compare on the `p<digits>` segment, falling back to a digit match.
function findMessageByLink(store: StoredMessage[], link: string): StoredMessage | undefined {
  const digits = link.replace(/\D/g, '');
  return store.find((m) => {
    const tsDigits = m.ts.replace('.', '');
    return digits.includes(tsDigits) || link.trim() === permalinkFor(m);
  });
}

const INITIAL_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Welcome to the Block Kitchen demo' }
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'Pick a template on the right to load it here, or drag blocks from the palette to start from scratch.'
    }
  },
  { type: 'divider' }
];

async function loadChannels(): Promise<ChannelOption[]> {
  await new Promise((r) => setTimeout(r, 200));
  return MOCK_CHANNELS;
}

const ASIDE_MIN = 280;
const ASIDE_MAX = 640;
const ASIDE_DEFAULT = 380;
const ASIDE_COLLAPSED = 32;
// Below this viewport width, the palette + editor + templates can't fit
// inline without the editor's internal palette (288px) bleeding into the
// templates panel. Auto-collapse rather than ship that broken layout.
const AUTO_COLLAPSE_BELOW = 960;

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [preset, setPreset] = useState<BrandPreset>('default');

  // Mirror `theme` onto <html> so the .dark CSS-variable rule reaches
  // Radix portals (sheets, dialogs, popovers, tooltips). They mount
  // under <body>, so a wrapper-div .dark would never cascade to them.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    return () => root.classList.remove('dark');
  }, [theme]);

  // Lifted draft blocks. The builder reads them on mount; updating this
  // state alone won't refresh an already-mounted builder, so we pair it
  // with `builderKey` below.
  const [blocks, setBlocks] = useState<SupportedBlock[]>(INITIAL_BLOCKS);
  // Bumped on every template selection so React unmounts and re-mounts
  // <BlockKitchen>, causing it to re-read `initialBlocks={blocks}`.
  // (`initialBlocks` is intentionally a mount-time prop; this `key`
  // pattern is the supported way to programmatically reset the draft.)
  const [builderKey, setBuilderKey] = useState(0);

  const handleSelectTemplate = (template: Template) => {
    setBlocks(template.blocks);
    setBuilderKey((n) => n + 1);
  };

  // --- Edit-mode demo knobs + in-memory store ------------------------------
  const [editingEnabled, setEditingEnabled] = useState(true);
  const [canSendAsUser, setCanSendAsUser] = useState(true);
  const [includeOauthUrl, setIncludeOauthUrl] = useState(true);
  const [store, setStore] = useState<StoredMessage[]>(SEED_MESSAGES);

  // Read the latest store from inside the stable `onLoadMessage` callback
  // without making it a dependency (the package captures it directly).
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  });

  const loadSendAsUserStatus = useCallback(async (): Promise<SendAsUserStatus> => {
    await new Promise((r) => setTimeout(r, 150));
    if (canSendAsUser) {
      return { canSendAsUser: true };
    }
    return {
      canSendAsUser: false,
      oauthUrl: includeOauthUrl ? 'https://slack.com/oauth/v2/authorize?mock=1' : undefined
    };
  }, [canSendAsUser, includeOauthUrl]);

  const onSend = useCallback(async (payload: SendPayload): Promise<SendResult> => {
    await new Promise((r) => setTimeout(r, 300));
    const channel = MOCK_CHANNELS.find((c) => c.id === payload.channelId);
    setStore((prev) => {
      const ts = `${Math.floor(Date.now() / 1000)}.${String(prev.length).padStart(6, '0')}`;
      const posted: StoredMessage = {
        ts,
        channelId: payload.channelId,
        channelName: channel?.name ?? payload.channelId,
        author: payload.sendAsUser ? 'you' : 'bot',
        kind: 'normal',
        blocks: payload.blocks
      };
      return [...prev, posted];
    });
    return { ok: true };
  }, []);

  // Mirrors the verdict a real host computes from `conversations.replies`.
  const onLoadMessage = useCallback(async ({ link }: LoadMessageInput): Promise<LoadResult> => {
    await new Promise((r) => setTimeout(r, 250));
    const msg = findMessageByLink(storeRef.current, link);
    if (!msg) {
      return { ok: false, reason: 'No message matched that link. Copy a link from the store on the right.' };
    }
    if (msg.kind === 'non-block') {
      return {
        ok: false,
        reason: "This message has no editable blocks (it may be attachment-only), so it can't be opened in the editor."
      };
    }
    if (msg.kind === 'edit-window-closed') {
      return { ok: false, reason: "This message is past Slack's edit window and can no longer be edited." };
    }
    if (msg.author === 'someoneElse') {
      return {
        ok: false,
        reason: "This message was posted by someone else, so it can't be edited. You can repost its content as a new message.",
        blocks: msg.blocks
      };
    }
    const base = {
      channelId: msg.channelId,
      channelName: msg.channelName,
      ts: msg.ts,
      blocks: msg.blocks,
      workspaceName: WORKSPACE_NAME
    } as const;
    return msg.author === 'bot'
      ? { ok: true, ...base, editableVia: 'bot' }
      : { ok: true, ...base, editableVia: 'user' };
  }, []);

  const onUpdate = useCallback(async ({ ts, blocks: updated }: UpdatePayload): Promise<UpdateResult> => {
    await new Promise((r) => setTimeout(r, 300));
    setStore((prev) => prev.map((m) => (m.ts === ts ? { ...m, blocks: updated } : m)));
    return { ok: true };
  }, []);

  // "Recent messages from this app" — round-trippable fixtures the app
  // authored, whether posted as the bot or as the current user (plus anything
  // sent during the session). Each carries the identity it was posted as via
  // `editableVia`, which the picker surfaces and the update uses to pick the
  // token. Messages by someone else (or that don't round-trip) are excluded.
  // Conservative host behavior: drop the user's own messages when there's no
  // user token, rather than offer an edit that can't complete without re-auth.
  const loadRecentMessages = useCallback(async (): Promise<RecentMessage[]> => {
    await new Promise((r) => setTimeout(r, 200));
    return storeRef.current
      .filter((m) => {
        if (m.kind !== 'normal' || m.blocks.length === 0) return false;
        if (m.author === 'bot') return true;
        return m.author === 'you' && canSendAsUser;
      })
      .map((m): RecentMessage => ({
        channelId: m.channelId,
        channelName: m.channelName,
        ts: m.ts,
        blocks: m.blocks,
        editableVia: m.author === 'you' ? 'user' : 'bot',
        label: previewOf(m.blocks),
        workspaceName: WORKSPACE_NAME
      }));
  }, [canSendAsUser]);

  const [asideWidth, setAsideWidth] = useState<number>(ASIDE_DEFAULT);

  // Collapse state. `narrow` follows the viewport; user clicks override
  // until the next viewport-threshold crossing, then auto rules again.
  const [narrow, setNarrow] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth < AUTO_COLLAPSE_BELOW
  );
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  const collapsed = manualCollapsed ?? narrow;

  useEffect(() => {
    const update = () => setNarrow(window.innerWidth < AUTO_COLLAPSE_BELOW);
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Drop any manual override when the viewport crosses the threshold so
  // the auto rule resumes — otherwise users get stuck with a stale choice.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally
  // resets manual override only on threshold crossings.
  useEffect(() => {
    setManualCollapsed(null);
  }, [narrow]);

  const handleResizePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startW = asideWidth;
    const move = (ev: PointerEvent) => {
      const next = Math.min(ASIDE_MAX, Math.max(ASIDE_MIN, startW + (startX - ev.clientX)));
      setAsideWidth(next);
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };

  const handleResizeKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setAsideWidth((w) => Math.min(ASIDE_MAX, w + 16));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setAsideWidth((w) => Math.max(ASIDE_MIN, w - 16));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setAsideWidth(ASIDE_MAX);
    } else if (e.key === 'End') {
      e.preventDefault();
      setAsideWidth(ASIDE_MIN);
    }
  };

  return (
    <div style={{ height: '100%' }}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 16, gap: 12 }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <img
              src="/logo.png"
              alt=""
              width={32}
              height={32}
              style={{ borderRadius: 6, flexShrink: 0 }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                block-kitchen <span className="hidden sm:inline">— live demo</span>
              </div>
              <div className="hidden sm:block" style={{ fontSize: 12, opacity: 0.7 }}>
                Drag blocks from the palette, edit them in place, and send to a (mocked) Slack channel.{' '}
                <a
                  href="https://github.com/TightknitAI/block-kitchen"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  GitHub
                </a>
                {' · '}
                <a
                  href="https://www.npmjs.com/package/@tightknitai/block-kitchen"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  npm
                </a>
                {' · by '}
                <a
                  href="https://tightknit.ai"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'inherit', textDecoration: 'underline' }}
                >
                  Tightknit
                </a>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <EditingMenu
              editingEnabled={editingEnabled}
              onEditingEnabledChange={setEditingEnabled}
              canSendAsUser={canSendAsUser}
              onCanSendAsUserChange={setCanSendAsUser}
              includeOauthUrl={includeOauthUrl}
              onIncludeOauthUrlChange={setIncludeOauthUrl}
              store={store}
            />
            <label
              htmlFor="brand-preset-picker"
              style={{
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'hsl(var(--foreground))',
                whiteSpace: 'nowrap'
              }}
            >
              <span className="hidden sm:inline">Theme</span>
              <select
                id="brand-preset-picker"
                aria-label="Theme"
                value={preset}
                onChange={(e) => setPreset(e.target.value as BrandPreset)}
                style={{
                  fontSize: 12,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--background))',
                  color: 'hsl(var(--foreground))',
                  cursor: 'pointer'
                }}
              >
                {PRESET_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode (current: ${theme})`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              style={{
                fontSize: 14,
                lineHeight: 1,
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                border: '1px solid hsl(var(--border))',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                cursor: 'pointer'
              }}
            >
              <span aria-hidden="true">{theme === 'light' ? '☀️' : '🌙'}</span>
            </button>
          </div>
        </header>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <BlockKitchen
              key={builderKey}
              workspaceName={WORKSPACE_NAME}
              initialBlocks={blocks}
              onChange={setBlocks}
              loadChannels={loadChannels}
              loadSendAsUserStatus={loadSendAsUserStatus}
              onSend={onSend}
              editing={editingEnabled ? { onLoadMessage, onUpdate, loadRecentMessages } : undefined}
              previewTheme={theme}
              theme={preset}
              allowedSurfaces={['message', 'modal', 'app_home']}
            />
          </div>
          <aside
            className="bk-root bk-demo-default"
            style={{
              flex: collapsed ? `0 0 ${ASIDE_COLLAPSED}px` : `0 1 ${asideWidth}px`,
              minWidth: collapsed ? ASIDE_COLLAPSED : ASIDE_MIN,
              maxWidth: collapsed ? ASIDE_COLLAPSED : ASIDE_MAX,
              position: 'relative',
              borderRadius: 6,
              border: '1px solid hsl(var(--border))',
              overflow: 'hidden',
              background: 'hsl(var(--background))'
            }}
          >
            {collapsed ? (
              <button
                type="button"
                onClick={() => setManualCollapsed(false)}
                title="Show templates"
                aria-label="Show templates panel"
                aria-expanded={false}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  color: 'hsl(var(--foreground))',
                  font: 'inherit'
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>
                  ‹
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    opacity: 0.7
                  }}
                >
                  Templates
                </span>
              </button>
            ) : (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Resize templates panel"
                  aria-valuemin={ASIDE_MIN}
                  aria-valuemax={ASIDE_MAX}
                  aria-valuenow={asideWidth}
                  tabIndex={0}
                  onPointerDown={handleResizePointerDown}
                  onKeyDown={handleResizeKeyDown}
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: -3,
                    width: 6,
                    cursor: 'col-resize',
                    zIndex: 1,
                    touchAction: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setManualCollapsed(true)}
                  title="Hide templates"
                  aria-label="Hide templates panel"
                  aria-expanded={true}
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    zIndex: 2,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: 'hsl(var(--foreground))',
                    fontSize: 14,
                    lineHeight: 1
                  }}
                >
                  ›
                </button>
                <TemplatePicker
                  templates={demoTemplates}
                  heading="Templates"
                  theme={theme}
                  onSelect={handleSelectTemplate}
                />
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

const AUTHOR_LABEL: Record<MessageAuthor, string> = {
  bot: 'this app (bot)',
  you: 'you',
  someoneElse: 'someone else'
};

const KIND_NOTE: Record<StoredMessage['kind'], string> = {
  normal: '',
  'non-block': ' · non-block',
  'edit-window-closed': ' · edit window closed'
};

/**
 * Header button that opens a modal owning all the mocked-host edit-mode
 * controls — the mode choice (Write-only vs Read & Write), the user-token
 * knobs, and the message store — so none of it lives on the page. The store
 * makes the load → update round-trip observable: copy a message's link, load
 * it in the builder, update, and watch the blocks change.
 */
function EditingMenu({
  editingEnabled,
  onEditingEnabledChange,
  canSendAsUser,
  onCanSendAsUserChange,
  includeOauthUrl,
  onIncludeOauthUrlChange,
  store
}: {
  editingEnabled: boolean;
  onEditingEnabledChange: (v: boolean) => void;
  canSendAsUser: boolean;
  onCanSendAsUserChange: (v: boolean) => void;
  includeOauthUrl: boolean;
  onIncludeOauthUrlChange: (v: boolean) => void;
  store: StoredMessage[];
}) {
  const [open, setOpen] = useState(false);
  const [copiedTs, setCopiedTs] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const copyLink = (msg: StoredMessage) => {
    navigator.clipboard?.writeText(permalinkFor(msg)).catch(() => {});
    setCopiedTs(msg.ts);
    window.setTimeout(() => setCopiedTs((cur) => (cur === msg.ts ? null : cur)), 1200);
  };

  const tab = (label: string, active: boolean, onSelect: () => void) => (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      style={{
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        background: 'transparent',
        border: 'none',
        marginBottom: -1,
        color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
        borderBottom: `2px solid ${active ? 'hsl(var(--primary))' : 'transparent'}`
      }}
    >
      {label}
    </button>
  );

  const checkbox = (label: string, checked: boolean, onChange: (v: boolean) => void, disabled?: boolean) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        style={{
          fontSize: 12,
          padding: '6px 8px',
          borderRadius: 6,
          border: '1px solid hsl(var(--border))',
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <span className="hidden sm:inline" style={{ opacity: 0.7 }}>
          Editing:
        </span>
        {editingEnabled ? 'Read & Write' : 'Write-only'}
      </button>
      {open &&
        createPortal(
          <div
            // biome-ignore lint/a11y/noStaticElementInteractions: demo-only overlay; the dialog has a focusable Close button.
            onMouseDown={() => setOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Edit-mode demo"
              className="bk-root"
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                width: 560,
                maxWidth: '100%',
                maxHeight: '85vh',
                overflow: 'auto',
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 12,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                padding: 20,
                fontSize: 13
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>Edit-mode demo</div>
                  <div style={{ opacity: 0.7, marginTop: 2 }}>
                    Mocks the host side of the package's <code>editing</code> prop.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  style={{
                    fontSize: 18,
                    lineHeight: 1,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
              </div>

              <div
                role="tablist"
                aria-label="Editing mode"
                style={{ display: 'flex', gap: 4, marginTop: 16, borderBottom: '1px solid hsl(var(--border))' }}
              >
                {tab('Write-only', !editingEnabled, () => onEditingEnabledChange(false))}
                {tab('Read & Write', editingEnabled, () => onEditingEnabledChange(true))}
              </div>

              <div role="tabpanel" style={{ paddingTop: 16 }}>
                {editingEnabled ? (
                  <>
                    <div style={{ opacity: 0.7, marginBottom: 12 }}>
                      Copy a link below, then use “Load message” in the toolbar, or pick a recent message.
                    </div>

                    <div style={{ fontWeight: 600, marginBottom: 8 }}>User-token settings</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                      {checkbox('User can edit their own messages (canSendAsUser)', canSendAsUser, onCanSendAsUserChange)}
                      {checkbox(
                        'Offer Slack sign-in link (oauthUrl)',
                        includeOauthUrl,
                        onIncludeOauthUrlChange,
                        canSendAsUser
                      )}
                    </div>

                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Message store</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {store.map((m) => (
                        <div
                          key={m.ts}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 6
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 12,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {m.ts}
                            </div>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>
                              #{m.channelName} · {AUTHOR_LABEL[m.author]}
                              {KIND_NOTE[m.kind]} · {m.blocks.length} block{m.blocks.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyLink(m)}
                            style={{
                              fontSize: 12,
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: '1px solid hsl(var(--border))',
                              background: 'hsl(var(--background))',
                              color: 'hsl(var(--foreground))',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {copiedTs === m.ts ? 'Copied!' : 'Copy link'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ opacity: 0.7 }}>
                    The <code>editing</code> prop is omitted, so the builder is a plain composer. “Load message” is
                    hidden and the primary action stays “Send”.
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
