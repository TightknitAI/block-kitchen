import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import type { SupportedBlock } from '../../types';
import { SlackBlockPreview } from './slack-block-preview';

const meta = {
  title: 'BlockKitchen/SlackBlockPreview',
  component: SlackBlockPreview,
  parameters: { layout: 'centered' },
  argTypes: {
    theme: {
      control: 'inline-radio',
      options: ['light', 'dark']
    },
    block: { control: { type: 'object' } }
  },
  args: { theme: 'light' },
  decorators: [
    (Story, { args }) => {
      const isDark = args.theme === 'dark';
      return (
        <div
          className="bk-root"
          style={{
            width: 600,
            padding: 24,
            background: isDark ? '#1a1d21' : '#ffffff',
            border: `1px solid ${isDark ? '#2c2d30' : '#e8e8e8'}`,
            borderRadius: 8
          }}
        >
          <Story />
        </div>
      );
    }
  ]
} satisfies Meta<typeof SlackBlockPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

// Helper preserves discriminated-union narrowing on each fixture.
const block = <T extends SupportedBlock>(b: T): T => b;

export const Header: Story = {
  args: {
    block: block({
      type: 'header',
      text: { type: 'plain_text', text: 'Welcome to Block Kit', emoji: true }
    })
  }
};

export const Section: Story = {
  args: {
    block: block({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'A *markdown* section. Supports _italic_, ~strike~, `code`, and <https://slack.com|links>.'
      }
    })
  }
};

export const SectionWithButtonAccessory: Story = {
  args: {
    block: block({
      type: 'section',
      text: { type: 'mrkdwn', text: 'A section with a button accessory on the right.' },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Click me', emoji: true },
        action_id: 'section_button'
      }
    })
  }
};

export const SectionWithImageAccessory: Story = {
  args: {
    block: block({
      type: 'section',
      text: { type: 'mrkdwn', text: 'A section with an image accessory on the right.' },
      accessory: {
        type: 'image',
        image_url: 'https://placehold.co/80x80?text=Img',
        alt_text: 'Placeholder accessory image'
      }
    })
  }
};

export const Divider: Story = {
  args: { block: block({ type: 'divider' }) }
};

export const Context: Story = {
  args: {
    block: block({
      type: 'context',
      elements: [
        { type: 'image', image_url: 'https://placehold.co/40x40?text=A', alt_text: 'Avatar' },
        { type: 'mrkdwn', text: '*Alex* posted in <#general>' }
      ]
    })
  }
};

export const Actions: Story = {
  args: {
    block: block({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          style: 'primary',
          action_id: 'approve'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Deny', emoji: true },
          style: 'danger',
          action_id: 'deny'
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Cancel', emoji: true },
          action_id: 'cancel'
        }
      ]
    })
  }
};

export const Image: Story = {
  args: {
    block: block({
      type: 'image',
      image_url: 'https://placehold.co/600x300?text=Image',
      alt_text: 'Placeholder image',
      title: { type: 'plain_text', text: 'Image title', emoji: true }
    })
  }
};

export const Markdown: Story = {
  args: {
    block: block({
      type: 'markdown',
      text: '**Roadmap**\n\n- Item one\n- Item two\n- Item three\n\n`inline code` and [a link](https://slack.com).'
    })
  }
};

export const RichText: Story = {
  args: {
    block: block({
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements: [
            { type: 'text', text: 'A rich text ' },
            { type: 'text', text: 'section', style: { bold: true } },
            { type: 'text', text: ' with inline ' },
            { type: 'text', text: 'styled', style: { italic: true } },
            { type: 'text', text: ' text.' }
          ]
        }
      ]
    })
  }
};

export const Input: Story = {
  args: {
    block: block({
      type: 'input',
      label: { type: 'plain_text', text: 'Email address', emoji: true },
      element: {
        type: 'email_text_input',
        action_id: 'email_text_input',
        placeholder: { type: 'plain_text', text: 'name@example.com', emoji: true }
      }
    })
  }
};

export const Card: Story = {
  args: {
    block: block({
      type: 'card',
      hero_image: {
        type: 'image',
        image_url: 'https://placehold.co/400x200?text=Hero',
        alt_text: 'Card hero image'
      },
      title: { type: 'mrkdwn', text: 'Card title' },
      body: { type: 'mrkdwn', text: 'A short description of what this card is about.' },
      actions: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Open', emoji: true },
          action_id: 'card_action_1'
        }
      ]
    })
  }
};

export const Carousel: Story = {
  args: {
    // Each card carries a button so the scrollable carousel container has
    // focusable descendants, which satisfies axe's
    // `scrollable-region-focusable` rule.
    block: block({
      type: 'carousel',
      elements: [
        {
          type: 'card',
          title: { type: 'mrkdwn', text: 'Card 1' },
          body: { type: 'mrkdwn', text: 'First card in the carousel.' },
          actions: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open 1', emoji: true },
              action_id: 'open_1'
            }
          ]
        },
        {
          type: 'card',
          title: { type: 'mrkdwn', text: 'Card 2' },
          body: { type: 'mrkdwn', text: 'Second card in the carousel.' },
          actions: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open 2', emoji: true },
              action_id: 'open_2'
            }
          ]
        },
        {
          type: 'card',
          title: { type: 'mrkdwn', text: 'Card 3' },
          body: { type: 'mrkdwn', text: 'Third card in the carousel.' },
          actions: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open 3', emoji: true },
              action_id: 'open_3'
            }
          ]
        }
      ]
    })
  }
};

export const ContextActions: Story = {
  args: {
    block: block({
      type: 'context_actions',
      elements: [
        {
          type: 'feedback_buttons',
          action_id: 'feedback',
          positive_button: {
            text: { type: 'plain_text', text: 'Good Response' },
            value: 'positive'
          },
          negative_button: {
            text: { type: 'plain_text', text: 'Bad Response' },
            value: 'negative'
          }
        },
        {
          type: 'icon_button',
          action_id: 'remove',
          icon: 'trash',
          text: { type: 'plain_text', text: 'Remove' }
        }
      ]
    })
  }
};

export const Alert: Story = {
  args: {
    block: block({
      type: 'alert',
      level: 'warning',
      text: { type: 'mrkdwn', text: 'Heads up: this action cannot be undone.' }
    })
  }
};

export const Table: Story = {
  args: {
    block: block({
      type: 'table',
      rows: [
        [
          { type: 'raw_text', text: 'Header 1' },
          { type: 'raw_text', text: 'Header 2' },
          { type: 'raw_text', text: 'Header 3' }
        ],
        [
          { type: 'raw_text', text: 'Row 1, A' },
          { type: 'raw_text', text: 'Row 1, B' },
          { type: 'raw_text', text: 'Row 1, C' }
        ],
        [
          { type: 'raw_text', text: 'Row 2, A' },
          { type: 'raw_text', text: 'Row 2, B' },
          { type: 'raw_text', text: 'Row 2, C' }
        ]
      ]
    })
  }
};

export const DataTable: Story = {
  args: {
    block: block({
      type: 'data_table',
      caption: 'Open deals',
      page_size: 2,
      rows: [
        [
          { type: 'raw_text', text: 'Deal' },
          { type: 'raw_text', text: 'Amount' }
        ],
        [
          { type: 'raw_text', text: 'Acme Expansion' },
          { type: 'raw_number', value: 1200000, text: '$1.2M' }
        ],
        [
          { type: 'raw_text', text: 'Partner Portal' },
          { type: 'raw_number', value: 98000, text: '$98K' }
        ],
        [
          { type: 'raw_text', text: 'Weather Integration' },
          { type: 'raw_number', value: 450000, text: '$450K' }
        ]
      ]
    })
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const table = await canvas.findByRole('table', { name: 'Open deals' });
    const bodyRows = () => within(table).getAllByRole('row').slice(1);

    await expect(bodyRows()).toHaveLength(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Next page' }));
    await expect(within(table).getByText('Weather Integration')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: /amount/i }));
    await expect(bodyRows()[0]).toHaveTextContent('Partner Portal');
  }
};

export const WithDirectiveHooks: Story = {
  args: {
    block: block({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Hello <@U123>, please review <#C456>. :tada:'
      }
    }),
    hooks: {
      user: ({ id }: { id: string }) => `@user-${id}`,
      channel: ({ id }: { id: string }) => `#channel-${id}`,
      emoji: ({ name }: { name: string }) => `:${name}:`
    }
  }
};
