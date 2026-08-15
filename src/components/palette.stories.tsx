import { DndContext } from '@dnd-kit/core';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlignLeft } from 'lucide-react';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import { defaultPalette, type PaletteSection } from '../lib/default-blocks';
import { Palette } from './palette';

const meta = {
  title: 'BlockKitchen/Palette',
  component: Palette,
  parameters: { a11y: { test: 'error' } },
  args: {
    onAddBlock: fn(),
    sections: defaultPalette
  },
  decorators: [
    (Story) => (
      <DndContext>
        <div className="bk-root flex h-[600px] border bg-background text-foreground">
          <Story />
        </div>
      </DndContext>
    )
  ]
} satisfies Meta<typeof Palette>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AddBlockViaChevron: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The Structure section has a "Divider" variant, so the chevron's
    // aria-label is "Add Divider to preview".
    const dividerAdd = await canvas.findByRole('button', { name: /^add divider to preview$/i });
    await userEvent.click(dividerAdd);
    await expect(args.onAddBlock).toHaveBeenCalledOnce();
    const [block] = (args.onAddBlock as ReturnType<typeof fn>).mock.calls[0];
    expect(block.type).toBe('divider');
  }
};

const CUSTOM_PALETTE: readonly PaletteSection[] = [
  ...defaultPalette.filter((s) => s.name === 'Section' || s.name === 'Structure'),
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
    sections: CUSTOM_PALETTE
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const helpAdd = await canvas.findByRole('button', { name: /^add help footer to preview$/i });
    await userEvent.click(helpAdd);
    await expect(args.onAddBlock).toHaveBeenCalledOnce();
    const [block] = (args.onAddBlock as ReturnType<typeof fn>).mock.calls[0];
    expect(block.type).toBe('section');
  }
};

export const WithSearchQuery: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole('searchbox', { name: /search blocks/i });
    await userEvent.type(search, 'select');
    // "All selects", "Selects with initial values" live under Actions;
    // "Select" lives under Input.
    await canvas.findByText('All selects');
    await canvas.findByText('Selects with initial values');
    await canvas.findByText('Select');
  }
};

export const AllCollapsed: Story = {
  args: {
    defaultOpenSections: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const structureHeader = await canvas.findByRole('button', { name: /^structure$/i });
    expect(structureHeader).toHaveAttribute('aria-expanded', 'false');
    expect(canvas.queryByRole('button', { name: /^add divider to preview$/i })).toBeNull();
  }
};

export const OnlySectionOpen: Story = {
  args: {
    defaultOpenSections: ['Section']
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const sectionHeader = await canvas.findByRole('button', { name: /^section$/i });
    expect(sectionHeader).toHaveAttribute('aria-expanded', 'true');
    const structureHeader = await canvas.findByRole('button', { name: /^structure$/i });
    expect(structureHeader).toHaveAttribute('aria-expanded', 'false');
  }
};

export const CollapseToggle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const structureHeader = await canvas.findByRole('button', { name: /^structure$/i });
    expect(structureHeader).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(structureHeader);
    expect(structureHeader).toHaveAttribute('aria-expanded', 'false');
    expect(canvas.queryByRole('button', { name: /^add divider to preview$/i })).toBeNull();
    await userEvent.click(structureHeader);
    expect(structureHeader).toHaveAttribute('aria-expanded', 'true');
  }
};

export const NoMatchEmptyState: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole('searchbox', { name: /search blocks/i });
    await userEvent.type(search, 'zzzzzz');
    await canvas.findByText(/no blocks match/i);
  }
};

export const SearchHidden: Story = {
  args: {
    showSearch: false
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole('searchbox')).toBeNull();
    // Sections still render normally. Use "Structure" — its variant
    // labels ("Header", "Divider") don't collide with the header text.
    await canvas.findByRole('button', { name: /^structure$/i });
  }
};

export const CustomSearchPlaceholder: Story = {
  args: {
    searchPlaceholder: 'Find a block…'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('searchbox', { name: /find a block/i });
  }
};

export const SimpleMode: Story = {
  args: {
    mode: 'simple'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // One block, flat — no section headings, no search.
    await canvas.findByRole('button', { name: /^add rich text section to preview$/i });
    await canvas.findByText('Message Elements');
    expect(canvas.queryByRole('searchbox')).toBeNull();
    expect(canvas.queryByRole('button', { name: /^add divider to preview$/i })).toBeNull();
    expect(canvas.queryByRole('button', { name: /^structure$/i })).toBeNull();
  }
};

export const SimpleModeAdvancedLink: Story = {
  args: {
    mode: 'simple'
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = await canvas.findByRole('button', { name: /^advanced block palette$/i });

    // Hovering explains what's behind the link before the user commits to it.
    // The tooltip portals out of the canvas, so it's queried on the document.
    await userEvent.hover(link);
    const help = await screen.findByText(/browse every slack block type/i);
    expect(help).toBeTruthy();
    await userEvent.unhover(link);

    // Clicking it swaps in the full palette, search and all.
    await userEvent.click(link);
    await canvas.findByRole('searchbox', { name: /search blocks/i });
    await canvas.findByRole('button', { name: /^add divider to preview$/i });

    // ...and the same link leads back.
    await userEvent.click(await canvas.findByRole('button', { name: /^basic block palette$/i }));
    expect(canvas.queryByRole('searchbox')).toBeNull();
    await canvas.findByRole('button', { name: /^add rich text section to preview$/i });
  }
};

export const SimpleModeWithoutBasicVariants: Story = {
  args: {
    mode: 'simple',
    // No variant here opts into the simple list, so there's nothing to show
    // in it — the palette renders the full list instead of an empty rail.
    sections: CUSTOM_PALETTE
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole('button', { name: /^add help footer to preview$/i });
    await canvas.findByRole('searchbox', { name: /search blocks/i });
    expect(canvas.queryByRole('button', { name: /^advanced block palette$/i })).toBeNull();
  }
};
