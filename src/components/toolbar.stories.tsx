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
