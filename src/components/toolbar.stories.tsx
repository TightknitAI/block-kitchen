import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TooltipProvider } from '../lib/ui/tooltip';
import { Toolbar } from './toolbar';

const meta = {
  title: 'BlockKitchen/Toolbar',
  component: Toolbar,
  parameters: { layout: 'fullscreen', a11y: { test: 'error' } },
  args: {
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

// Edit mode configured but no message loaded yet: the "Load message" entry
// appears and the primary action stays "Send".
export const EditingEnabled: Story = {
  args: { editingEnabled: true, onOpenLoad: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('button', { name: 'Load message' }));
    await expect(args.onOpenLoad).toHaveBeenCalledOnce();
    await expect(await canvas.findByRole('button', { name: 'Send' })).toBeInTheDocument();
  }
};

// A message is loaded for editing: the badge shows and the primary action
// flips to "Review & update".
export const EditingActive: Story = {
  args: {
    editingEnabled: true,
    editBadge: { channelLabel: '#engineering', ts: '1718000042.000100' },
    onExitEdit: fn()
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Review & update' })).toBeInTheDocument();
    await userEvent.click(await canvas.findByRole('button', { name: 'Switch to a new message' }));
    await expect(args.onExitEdit).toHaveBeenCalledOnce();
  }
};
