import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TooltipProvider } from '../lib/ui/tooltip';
import { Toolbar } from './toolbar';

const meta = {
  title: 'BlockKitchen/Toolbar',
  component: Toolbar,
  parameters: { layout: 'fullscreen', a11y: { test: 'error' } },
  args: {
    onUndo: fn(),
    onRedo: fn(),
    canUndo: false,
    canRedo: false,
    onClear: fn(),
    onOpenJson: fn(),
    onOpenIssues: fn(),
    onOpenSend: fn(),
    canSend: true,
    canClear: true,
    previewTheme: 'light',
    onPreviewThemeChange: fn(),
    previewSurface: 'message',
    onPreviewSurfaceChange: fn(),
    allowedSurfaces: ['message', 'modal', 'app_home'],
    errorCount: 0
  },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={0}>
        <div className="bk-root border-b">
          <Story />
        </div>
      </TooltipProvider>
    )
  ]
} satisfies Meta<typeof Toolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { canSend: false, canClear: false }
};

export const WithIssues: Story = {
  args: { errorCount: 3 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const issuesBtn = await canvas.findByRole('button', { name: /3 issues/i });
    await userEvent.click(issuesBtn);
    await expect(args.onOpenIssues).toHaveBeenCalledOnce();
  }
};

export const SurfaceControlHidden: Story = {
  args: { allowedSurfaces: ['message'] }
};

export const ThemeControlHidden: Story = {
  args: { showThemeControl: false }
};

export const CustomSendLabel: Story = {
  args: { sendButtonLabel: 'Send to channel…' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Send to channel…' })).toBeInTheDocument();
  }
};

// Undo/redo are disabled when there's no history to walk. This is the
// builder's initial state — nothing to undo, nothing to redo.
export const HistoryEmpty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const undo = await canvas.findByRole('button', { name: 'Undo' });
    const redo = await canvas.findByRole('button', { name: 'Redo' });
    await expect(undo).toBeDisabled();
    await expect(redo).toBeDisabled();
  }
};

// With history available, both controls are live and invoke their handlers.
export const HistoryAvailable: Story = {
  args: { canUndo: true, canRedo: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Undo' }));
    await expect(args.onUndo).toHaveBeenCalledOnce();
    await userEvent.click(await canvas.findByRole('button', { name: 'Redo' }));
    await expect(args.onRedo).toHaveBeenCalledOnce();
  }
};

export const DocsLinkHidden: Story = {
  args: { docsLink: false }
};

export const DocsLinkCustom: Story = {
  args: {
    docsLink: { href: 'https://example.com/handbook/blocks', label: 'Handbook' }
  }
};

export const ClickSendInvokesHandler: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const sendBtn = await canvas.findByRole('button', { name: /send/i });
    await userEvent.click(sendBtn);
    await expect(args.onOpenSend).toHaveBeenCalledOnce();
  }
};

// Loading configured but no message loaded yet: the "Find message" entry
// appears and the primary action is a plain "Send".
export const LoadingEnabled: Story = {
  args: { loadEnabled: true, onOpenLoad: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Find message' }));
    await expect(args.onOpenLoad).toHaveBeenCalledOnce();
    await expect(await canvas.findByRole('button', { name: 'Review & send' })).toBeInTheDocument();
  }
};

// A message is loaded and update-in-place is wired: the banner shows and
// the primary split button reads "Review & update" with a "More message
// options" menu.
export const EditingActive: Story = {
  args: {
    loadEnabled: true,
    updateEnabled: true,
    editBadge: { channelLabel: '#engineering', ts: '1718000042.000100' },
    onOpenUpdate: fn(),
    onExitEdit: fn()
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Review & update' }));
    await expect(args.onOpenUpdate).toHaveBeenCalledOnce();
    await expect(await canvas.findByRole('button', { name: 'More message options' })).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Switch to a new message' }));
    await expect(args.onExitEdit).toHaveBeenCalledOnce();
  }
};
