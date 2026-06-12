import {
  BlockKitchen,
  type BrandPreset,
  type ChannelOption,
  type SendAsUserStatus,
  type SendPayload,
  type SendResult,
  type SupportedBlock,
  type Template,
  TemplatePicker
} from '@tightknitai/block-kitchen';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useState
} from 'react';
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

async function loadSendAsUserStatus(): Promise<SendAsUserStatus> {
  await new Promise((r) => setTimeout(r, 150));
  return { canSendAsUser: true };
}

async function onSend(payload: SendPayload): Promise<SendResult> {
  await new Promise((r) => setTimeout(r, 400));
  console.log('[demo] onSend called with', payload);
  const channel = MOCK_CHANNELS.find((c) => c.id === payload.channelId);
  window.alert(
    `Mock send to #${channel?.name ?? payload.channelId}\n` +
      `${payload.blocks.length} block${payload.blocks.length === 1 ? '' : 's'} — ` +
      `sendAsUser=${payload.sendAsUser}\n\nSee console for full payload.`
  );
  return { ok: true };
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
              <span className="hidden sm:inline">Mode: </span>
              {theme}
            </button>
          </div>
        </header>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 12 }}>
          <div style={{ flex: '1 1 360px', minWidth: 0 }}>
            <BlockKitchen
              key={builderKey}
              workspaceName="Acme Inc."
              initialBlocks={blocks}
              onChange={setBlocks}
              loadChannels={loadChannels}
              loadSendAsUserStatus={loadSendAsUserStatus}
              onSend={onSend}
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
