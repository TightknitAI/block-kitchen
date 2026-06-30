import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlignLeft } from 'lucide-react';
import { expect, fireEvent, fn, userEvent, waitFor, within } from 'storybook/test';
import { defaultPalette, type PaletteSection } from '../lib/default-blocks';
import type { SupportedBlock } from '../types';
import { BlockKitchen } from './block-kitchen';

const STARTER_BLOCKS: SupportedBlock[] = [
  {
    type: 'header',
    text: { type: 'plain_text', text: 'Welcome to Block Kit', emoji: true }
  },
  {
    type: 'section',
    text: { type: 'mrkdwn', text: 'Compose Slack messages visually, then *send* or copy the JSON.' }
  },
  { type: 'divider' },
  {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: 'Tip: drag a block from the palette on the left.' }]
  }
];

const meta = {
  title: 'BlockKitchen/BlockKitchen',
  component: BlockKitchen,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'todo' }
  },
  args: {
    workspaceName: 'Acme Inc.',
    loadChannels: fn(async () => [
      { id: 'C100', name: 'general' },
      { id: 'C200', name: 'random' }
    ]),
    loadSendAsUserStatus: fn(async () => ({ canSendAsUser: true })),
    onSend: fn(async () => ({ ok: true })),
    onChange: fn()
  },
  decorators: [
    (Story) => (
      <div className="bk-root" style={{ height: '100vh', width: '100vw' }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof BlockKitchen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithStarterBlocks: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS
  }
};

export const MessageSurfaceLocked: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    showThemeControl: false
  }
};

export const AllSurfaces: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    allowedSurfaces: ['message', 'modal', 'app_home']
  }
};

const RESTRICTED_SECTION_NAMES = new Set(['Section', 'Markdown', 'Structure']);
const RESTRICTED_PALETTE: readonly PaletteSection[] = defaultPalette.filter((s) =>
  RESTRICTED_SECTION_NAMES.has(s.name)
);

export const RestrictedBlockTypes: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    palette: RESTRICTED_PALETTE
  }
};

const CUSTOM_VARIANT_PALETTE: readonly PaletteSection[] = [
  ...defaultPalette,
  {
    name: 'Company presets',
    icon: AlignLeft,
    variants: [
      {
        id: 'help_footer',
        label: 'help footer',
        factory: () => ({
          type: 'section',
          text: { type: 'mrkdwn', text: 'Need help? Reach out in <#C0HELP>.' }
        })
      }
    ]
  }
];

export const CustomPalette: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    palette: CUSTOM_VARIANT_PALETTE
  }
};

export const DarkPreviewDefault: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    defaultPreviewTheme: 'dark'
  }
};

export const ControlledPreviewTheme: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    previewTheme: 'dark'
  },
  parameters: {
    docs: {
      description: {
        story:
          'When the host passes `previewTheme`, the preview is fully controlled and the toolbar light/dark toggle is hidden — the host app drives the theme.'
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The toggle is hidden under a controlled theme, so no "Preview theme:"
    // trigger should exist.
    await expect(canvas.queryByRole('button', { name: /preview theme/i })).not.toBeInTheDocument();
  }
};

export const CustomSendButtonLabel: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    sendButtonLabel: 'Send to channel…'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole('button', { name: 'Send to channel…' })).toBeInTheDocument();
  }
};

export const Branded: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    theme: {
      tokens: {
        primary: '262 83% 58%',
        primaryForeground: '0 0% 100%',
        ring: '262 83% 58%',
        radius: '0.75rem'
      }
    }
  },
  parameters: {
    docs: {
      description: {
        story:
          'Brand tokens reshape the builder chrome (primary buttons, focus rings, corner radius). The Slack preview keeps its faithful Slack styling because `slack-blocks-to-jsx` is scoped under its own CSS namespace.'
      }
    }
  }
};

export const BrandedDarkVariant: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS,
    defaultPreviewTheme: 'dark',
    theme: {
      tokens: { radius: '0.75rem' },
      light: { primary: '262 83% 58%' },
      // A full dark token set so the chrome reads as a coherent
      // brand-aware theme — not just a primary color sitting on top of
      // generic shadcn-dark defaults. Lifted brightness on the primary
      // for contrast on dark surfaces.
      dark: {
        primary: '263 70% 75%',
        primaryForeground: '224 71% 4%',
        background: '224 71% 4%',
        foreground: '210 40% 98%',
        card: '224 71% 4%',
        cardForeground: '210 40% 98%',
        popover: '224 71% 4%',
        popoverForeground: '210 40% 98%',
        secondary: '215 28% 17%',
        secondaryForeground: '210 40% 98%',
        muted: '215 28% 17%',
        mutedForeground: '217 11% 65%',
        accent: '215 28% 17%',
        accentForeground: '210 40% 98%',
        border: '215 28% 17%',
        input: '215 28% 17%',
        ring: '263 70% 75%'
      }
    }
  },
  decorators: [
    (Story) => (
      <div className="dark bk-root" style={{ height: '100vh', width: '100vw', background: 'hsl(224 71% 4%)' }}>
        <Story />
      </div>
    )
  ],
  parameters: {
    docs: {
      description: {
        story:
          'A complete branded dark theme. `tokens` carries values that apply in both modes (here, just `radius`), while `light` and `dark` carry per-mode overrides. The chrome reads as a coherent brand-aware dark surface; the Slack preview keeps its faithful Slack rendering.'
      }
    }
  }
};

export const ClearButtonResetsBlocks: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    await expect(canvas.queryByText('Welcome to Block Kit')).toBeInTheDocument();

    const clearBtn = await canvas.findByRole('button', { name: /clear/i });
    await userEvent.click(clearBtn);

    await expect(canvas.queryByText('Welcome to Block Kit')).not.toBeInTheDocument();
    await expect(args.onChange).toHaveBeenCalled();
  }
};

export const AddSectionFromPalette: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // "with button accessory" is unique to the Section palette group, so it
    // resolves to exactly one chevron button.
    const addSection = await canvas.findByRole('button', {
      name: /add with button accessory to preview/i
    });
    await userEvent.click(addSection);

    await expect(args.onChange).toHaveBeenCalled();
    const sendBtn = await canvas.findByRole('button', { name: /review & send/i });
    await expect(sendBtn).toBeEnabled();
  }
};

export const ReorderBlocksViaDrag: Story = {
  args: {
    initialBlocks: STARTER_BLOCKS
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Anchor on rendered preview text to find each block's row trigger.
    // The hover toolbar also has aria-label="Edit block" pencil buttons,
    // so finding by role would be ambiguous; the row trigger is the
    // role="button" div ancestor of the preview content.
    const headerText = await canvas.findByText('Welcome to Block Kit');
    const sectionText = await canvas.findByText(/compose slack messages/i);
    const headerRow = headerText.closest('div[role="button"]') as HTMLElement | null;
    const sectionRow = sectionText.closest('div[role="button"]') as HTMLElement | null;
    expect(headerRow).not.toBeNull();
    expect(sectionRow).not.toBeNull();

    const headerRect = headerRow!.getBoundingClientRect();
    const sectionRect = sectionRow!.getBoundingClientRect();

    // dnd-kit's PointerSensor checks `event.isPrimary` and `button === 0`;
    // PointerEventInit defaults isPrimary to false, so set it explicitly.
    const pointer = { pointerId: 1, button: 0, isPrimary: true };

    fireEvent.pointerDown(headerRow!, {
      ...pointer,
      clientX: headerRect.left + headerRect.width / 2,
      clientY: headerRect.top + headerRect.height / 2
    });
    // Clear the 4px activation distance configured in block-kitchen.tsx.
    fireEvent.pointerMove(headerRow!, {
      ...pointer,
      clientX: headerRect.left + headerRect.width / 2,
      clientY: headerRect.top + headerRect.height / 2 + 12
    });
    // Land inside the section row so `pointerWithin` resolves it as the
    // drop target, which reorders the dragged header to that index.
    fireEvent.pointerMove(sectionRow!, {
      ...pointer,
      clientX: sectionRect.left + sectionRect.width / 2,
      clientY: sectionRect.top + sectionRect.height / 2
    });
    fireEvent.pointerUp(sectionRow!, pointer);

    await waitFor(() => {
      const calls = (args.onChange as ReturnType<typeof fn>).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const latest = calls[calls.length - 1][0] as SupportedBlock[];
      expect(latest.map((b) => b.type)).toEqual(['section', 'header', 'divider', 'context']);
    });
  }
};
