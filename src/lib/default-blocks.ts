import {
  AlignLeft,
  Bell,
  ChartColumnBig,
  FileText,
  GalleryHorizontal,
  Image as ImageIcon,
  LayoutTemplate,
  MousePointerClick,
  Pilcrow,
  Sparkles,
  Table as TableIcon,
  TextCursorInput,
  Video as VideoIcon
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import type { SupportedBlock, SupportedBlockType } from '../types';

/**
 * One pre-built block example shown as a draggable item in the palette.
 * Modeled on Slack's real Block Kit Builder ("All selects", "Datepickers",
 * "Filtered conversation", etc).
 */
export interface PaletteVariant {
  /** Stable id used as the DnD draggable id (`palette:${id}`). */
  id: string;
  /** Visible label shown next to the `+` icon. */
  label: string;
  /** Builds a fresh block payload when this variant is dropped. */
  factory: () => SupportedBlock;
}

/**
 * One section in the palette. Sections group related variants under a
 * single heading + icon, matching Slack's Block Kit Builder sidebar
 * (Agents, Markdown, Section, Actions, Input, Structure, Rich Text,
 * Image, Card and Carousel, Table).
 *
 * Variant ids must be unique across the entire palette — the drag-drop
 * variant lookup keys by id, so a duplicate would shadow the earlier one.
 */
export interface PaletteSection {
  /** Visible heading for the section. */
  name: string;
  /** Lucide icon component rendered next to the section heading. */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variants: PaletteVariant[];
}

/**
 * The built-in palette. Mirrors Slack's real Block Kit Builder: related
 * variants (e.g. every select type) are combined into single showcase
 * `actions` blocks ("All selects", "Datepickers") rather than each
 * variant being its own row. The full set of single-element `input`
 * variants is still available via {@link legacyInputVariants}.
 */
export const defaultPalette: readonly PaletteSection[] = [
  {
    name: 'Agents',
    icon: Sparkles,
    variants: [
      {
        id: 'agents_feedback_remove',
        label: 'Feedback + remove',
        factory: () => ({
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
      },
      {
        id: 'agents_feedback_only',
        label: 'Feedback only',
        factory: () => ({
          type: 'context_actions',
          elements: [
            {
              type: 'feedback_buttons',
              action_id: 'feedback',
              positive_button: {
                text: { type: 'plain_text', text: '👍' },
                value: 'positive'
              },
              negative_button: {
                text: { type: 'plain_text', text: '👎' },
                value: 'negative'
              }
            }
          ]
        })
      },
      {
        id: 'agents_plan',
        label: 'Plan',
        factory: () => ({
          type: 'plan',
          title: 'Investigating the issue',
          tasks: [
            {
              type: 'task_card',
              task_id: 'task_1',
              title: 'Read the bug report',
              status: 'complete'
            },
            {
              type: 'task_card',
              task_id: 'task_2',
              title: 'Reproduce the error locally',
              status: 'in_progress'
            },
            {
              type: 'task_card',
              task_id: 'task_3',
              title: 'Identify the root cause',
              status: 'pending'
            }
          ]
        })
      },
      {
        id: 'agents_task_card',
        label: 'Task card',
        factory: () => ({
          type: 'task_card',
          task_id: 'task_1',
          title: 'Summarize the latest release notes',
          status: 'in_progress'
        })
      },
      {
        id: 'agents_task_card_with_sources',
        label: 'Task card with sources',
        factory: () => ({
          type: 'task_card',
          task_id: 'task_2',
          title: 'Cite supporting docs',
          status: 'complete',
          sources: [
            {
              type: 'url',
              url: 'https://example.com/runbook',
              text: 'Runbook'
            },
            {
              type: 'url',
              url: 'https://example.com/changelog',
              text: 'Changelog'
            }
          ]
        })
      }
    ]
  },
  {
    name: 'Markdown',
    icon: FileText,
    variants: [
      {
        id: 'markdown_basic',
        label: 'Basic',
        factory: () => ({
          type: 'markdown',
          text: 'A **markdown** block. Supports _italic_, ~~strike~~, `code`, [links](https://slack.com), lists, tables, and task lists.'
        })
      },
      {
        id: 'markdown_list',
        label: 'List',
        factory: () => ({
          type: 'markdown',
          text: '**Roadmap**\n\n- Item one\n- Item two\n- Item three'
        })
      },
      {
        id: 'markdown_code',
        label: 'Code block',
        factory: () => ({
          type: 'markdown',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: literal markdown source for a code-block sample
          text: '```ts\nconst greet = (name: string) => `Hello, ${name}!`;\n```'
        })
      }
    ]
  },
  {
    name: 'Section',
    icon: AlignLeft,
    variants: [
      {
        id: 'section_plain_text',
        label: 'Plain text',
        factory: () => ({
          type: 'section',
          text: {
            type: 'plain_text',
            text: 'A simple plain-text section.',
            emoji: true
          }
        })
      },
      {
        id: 'section_mrkdwn',
        label: 'Mrkdwn',
        factory: () => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'A *markdown* section. Supports _italic_, ~strike~, `code`, and <https://slack.com|links>.'
          }
        })
      },
      {
        id: 'section_with_button',
        label: 'With button accessory',
        factory: () => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'A section with a button accessory on the right.'
          },
          accessory: {
            type: 'button',
            text: { type: 'plain_text', text: 'Click me', emoji: true },
            action_id: 'section_button'
          }
        })
      },
      {
        id: 'section_with_image',
        label: 'With image accessory',
        factory: () => ({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: 'A section with an image accessory on the right.'
          },
          accessory: {
            type: 'image',
            image_url: 'https://placehold.co/80x80?text=Img',
            alt_text: 'Placeholder accessory image'
          }
        })
      }
    ]
  },
  {
    name: 'Actions',
    icon: MousePointerClick,
    variants: [
      {
        id: 'actions_all_selects',
        label: 'All selects',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'static_select',
              action_id: 'static_select',
              placeholder: { type: 'plain_text', text: 'Static', emoji: true },
              options: [
                {
                  text: { type: 'plain_text', text: 'Option 1', emoji: true },
                  value: 'option_1'
                },
                {
                  text: { type: 'plain_text', text: 'Option 2', emoji: true },
                  value: 'option_2'
                }
              ]
            },
            {
              type: 'users_select',
              action_id: 'users_select',
              placeholder: { type: 'plain_text', text: 'User', emoji: true }
            },
            {
              type: 'channels_select',
              action_id: 'channels_select',
              placeholder: { type: 'plain_text', text: 'Channel', emoji: true }
            },
            {
              type: 'conversations_select',
              action_id: 'conversations_select',
              placeholder: {
                type: 'plain_text',
                text: 'Conversation',
                emoji: true
              }
            },
            {
              type: 'external_select',
              action_id: 'external_select',
              placeholder: { type: 'plain_text', text: 'External', emoji: true },
              min_query_length: 0
            }
          ]
        })
      },
      {
        id: 'actions_filtered_conversation',
        label: 'Filtered conversation',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'conversations_select',
              action_id: 'filtered_conversations_select',
              placeholder: {
                type: 'plain_text',
                text: 'Pick a public channel',
                emoji: true
              },
              filter: {
                include: ['public'],
                exclude_bot_users: true,
                exclude_external_shared_channels: true
              }
            }
          ]
        })
      },
      {
        id: 'actions_selects_initial_values',
        label: 'Selects with initial values',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'static_select',
              action_id: 'static_select_initial',
              placeholder: { type: 'plain_text', text: 'Pick one', emoji: true },
              initial_option: {
                text: { type: 'plain_text', text: 'Option 2', emoji: true },
                value: 'option_2'
              },
              options: [
                {
                  text: { type: 'plain_text', text: 'Option 1', emoji: true },
                  value: 'option_1'
                },
                {
                  text: { type: 'plain_text', text: 'Option 2', emoji: true },
                  value: 'option_2'
                },
                {
                  text: { type: 'plain_text', text: 'Option 3', emoji: true },
                  value: 'option_3'
                }
              ]
            },
            {
              type: 'users_select',
              action_id: 'users_select_initial',
              placeholder: { type: 'plain_text', text: 'Pick a user', emoji: true },
              initial_user: 'U0LAN0Z89'
            },
            {
              type: 'channels_select',
              action_id: 'channels_select_initial',
              placeholder: {
                type: 'plain_text',
                text: 'Pick a channel',
                emoji: true
              },
              initial_channel: 'C012AB3CD'
            }
          ]
        })
      },
      {
        id: 'actions_button',
        label: 'Button',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Click me', emoji: true },
              action_id: 'button_1'
            }
          ]
        })
      },
      {
        id: 'actions_datepickers',
        label: 'Datepickers',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'datepicker',
              action_id: 'datepicker',
              placeholder: {
                type: 'plain_text',
                text: 'Select a date',
                emoji: true
              }
            },
            {
              type: 'timepicker',
              action_id: 'timepicker',
              placeholder: {
                type: 'plain_text',
                text: 'Select a time',
                emoji: true
              }
            },
            {
              type: 'datetimepicker',
              action_id: 'datetimepicker'
            }
          ]
        })
      },
      {
        id: 'actions_checkboxes',
        label: 'Checkboxes',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'checkboxes',
              action_id: 'checkboxes',
              options: [
                {
                  text: { type: 'plain_text', text: 'Option 1', emoji: true },
                  value: 'option_1'
                },
                {
                  text: { type: 'plain_text', text: 'Option 2', emoji: true },
                  value: 'option_2'
                },
                {
                  text: { type: 'plain_text', text: 'Option 3', emoji: true },
                  value: 'option_3'
                }
              ]
            }
          ]
        })
      },
      {
        id: 'actions_radio_buttons',
        label: 'Radio buttons',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'radio_buttons',
              action_id: 'radio_buttons',
              options: [
                {
                  text: { type: 'plain_text', text: 'Option 1', emoji: true },
                  value: 'option_1'
                },
                {
                  text: { type: 'plain_text', text: 'Option 2', emoji: true },
                  value: 'option_2'
                },
                {
                  text: { type: 'plain_text', text: 'Option 3', emoji: true },
                  value: 'option_3'
                }
              ]
            }
          ]
        })
      },
      {
        id: 'actions_timepicker',
        label: 'Timepicker',
        factory: () => ({
          type: 'actions',
          elements: [
            {
              type: 'timepicker',
              action_id: 'timepicker_only',
              placeholder: {
                type: 'plain_text',
                text: 'Select a time',
                emoji: true
              }
            }
          ]
        })
      }
    ]
  },
  {
    name: 'Input',
    icon: TextCursorInput,
    variants: [
      {
        id: 'input_plain_text',
        label: 'Plain text',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Label', emoji: true },
          element: {
            type: 'plain_text_input',
            action_id: 'plain_text_input',
            placeholder: {
              type: 'plain_text',
              text: 'Enter some text',
              emoji: true
            }
          }
        })
      },
      {
        id: 'input_multiline_text',
        label: 'Multiline text',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Description', emoji: true },
          element: {
            type: 'plain_text_input',
            action_id: 'plain_text_input_multiline',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Enter a longer description',
              emoji: true
            }
          }
        })
      },
      {
        id: 'input_email',
        label: 'Email',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Email address', emoji: true },
          element: {
            type: 'email_text_input',
            action_id: 'email_text_input',
            placeholder: {
              type: 'plain_text',
              text: 'name@example.com',
              emoji: true
            }
          }
        })
      },
      {
        id: 'input_url',
        label: 'URL',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Website', emoji: true },
          element: {
            type: 'url_text_input',
            action_id: 'url_text_input',
            placeholder: {
              type: 'plain_text',
              text: 'https://example.com',
              emoji: true
            }
          }
        })
      },
      {
        id: 'input_number',
        label: 'Number',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Quantity', emoji: true },
          element: {
            type: 'number_input',
            action_id: 'number_input',
            is_decimal_allowed: false,
            placeholder: { type: 'plain_text', text: '0', emoji: true }
          }
        })
      },
      {
        id: 'input_date',
        label: 'Date',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Pick a date', emoji: true },
          element: {
            type: 'datepicker',
            action_id: 'datepicker',
            placeholder: {
              type: 'plain_text',
              text: 'Select a date',
              emoji: true
            }
          }
        })
      },
      {
        id: 'input_select',
        label: 'Select',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Pick an option', emoji: true },
          element: {
            type: 'static_select',
            action_id: 'static_select',
            placeholder: {
              type: 'plain_text',
              text: 'Choose one',
              emoji: true
            },
            options: [
              {
                text: { type: 'plain_text', text: 'Option 1', emoji: true },
                value: 'option_1'
              },
              {
                text: { type: 'plain_text', text: 'Option 2', emoji: true },
                value: 'option_2'
              },
              {
                text: { type: 'plain_text', text: 'Option 3', emoji: true },
                value: 'option_3'
              }
            ]
          }
        })
      },
      {
        id: 'input_rich_text',
        label: 'Rich text',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Description', emoji: true },
          element: {
            type: 'rich_text_input',
            action_id: 'rich_text_input',
            placeholder: {
              type: 'plain_text',
              text: 'Type something',
              emoji: true
            }
          }
        })
      },
      {
        id: 'input_file',
        label: 'File upload',
        factory: () => ({
          type: 'input',
          label: { type: 'plain_text', text: 'Upload a file', emoji: true },
          element: {
            type: 'file_input',
            action_id: 'file_input',
            max_files: 1
          }
        })
      }
    ]
  },
  {
    name: 'Structure',
    icon: LayoutTemplate,
    variants: [
      {
        id: 'structure_header',
        label: 'Header',
        factory: () => ({
          type: 'header',
          text: { type: 'plain_text', text: 'Heading text', emoji: true }
        })
      },
      {
        id: 'structure_divider',
        label: 'Divider',
        factory: () => ({ type: 'divider' })
      },
      {
        id: 'structure_context_plain',
        label: 'Context (plain text)',
        factory: () => ({
          type: 'context',
          elements: [{ type: 'plain_text', text: 'Posted by your app', emoji: true }]
        })
      },
      {
        id: 'structure_context_mrkdwn',
        label: 'Context (mrkdwn)',
        factory: () => ({
          type: 'context',
          elements: [{ type: 'mrkdwn', text: 'Posted by *your app*' }]
        })
      },
      {
        id: 'structure_context_text_images',
        label: 'Context (text + images)',
        factory: () => ({
          type: 'context',
          elements: [
            {
              type: 'image',
              image_url: 'https://placehold.co/40x40?text=A',
              alt_text: 'Avatar'
            },
            { type: 'mrkdwn', text: '*Alex* posted in <#general>' }
          ]
        })
      }
    ]
  },
  {
    name: 'Alert',
    icon: Bell,
    variants: [
      {
        id: 'alert_default',
        label: 'Default',
        factory: () => ({
          type: 'alert',
          text: {
            type: 'mrkdwn',
            text: 'A neutral alert message.'
          }
        })
      },
      {
        id: 'alert_info',
        label: 'Info',
        factory: () => ({
          type: 'alert',
          level: 'info',
          text: {
            type: 'mrkdwn',
            text: 'FYI: the build finished in 42 seconds.'
          }
        })
      },
      {
        id: 'alert_warning',
        label: 'Warning',
        factory: () => ({
          type: 'alert',
          level: 'warning',
          text: {
            type: 'mrkdwn',
            text: 'Heads up: this action cannot be undone.'
          }
        })
      },
      {
        id: 'alert_error',
        label: 'Error',
        factory: () => ({
          type: 'alert',
          level: 'error',
          text: {
            type: 'mrkdwn',
            text: 'Something went wrong. Please try again.'
          }
        })
      },
      {
        id: 'alert_success',
        label: 'Success',
        factory: () => ({
          type: 'alert',
          level: 'success',
          text: {
            type: 'mrkdwn',
            text: 'Your changes have been saved.'
          }
        })
      }
    ]
  },
  {
    name: 'Rich Text',
    icon: Pilcrow,
    variants: [
      {
        id: 'rich_text_section',
        label: 'Section',
        factory: () => ({
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
    ]
  },
  {
    name: 'Image',
    icon: ImageIcon,
    variants: [
      {
        id: 'image_with_title',
        label: 'With title',
        factory: () => ({
          type: 'image',
          image_url: 'https://placehold.co/600x300?text=Image',
          alt_text: 'Placeholder image',
          title: { type: 'plain_text', text: 'Image title', emoji: true }
        })
      },
      {
        id: 'image_no_title',
        label: 'No title',
        factory: () => ({
          type: 'image',
          image_url: 'https://placehold.co/600x300?text=Image',
          alt_text: 'Placeholder image'
        })
      }
    ]
  },
  {
    name: 'Video',
    icon: VideoIcon,
    variants: [
      {
        id: 'video_basic',
        label: 'Basic',
        factory: () => ({
          type: 'video',
          alt_text: 'A short demo video',
          title: { type: 'plain_text', text: 'Product demo', emoji: true },
          thumbnail_url: 'https://placehold.co/600x340?text=Video',
          video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
        })
      },
      {
        id: 'video_with_metadata',
        label: 'With metadata',
        factory: () => ({
          type: 'video',
          alt_text: 'A short demo video',
          title: { type: 'plain_text', text: 'Product demo', emoji: true },
          title_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          thumbnail_url: 'https://placehold.co/600x340?text=Video',
          video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          author_name: 'Acme',
          description: {
            type: 'plain_text',
            text: 'A short walkthrough of the new release.',
            emoji: true
          },
          provider_name: 'YouTube',
          provider_icon_url: 'https://placehold.co/16x16?text=YT'
        })
      }
    ]
  },
  {
    name: 'Card and Carousel',
    icon: GalleryHorizontal,
    variants: [
      {
        id: 'card_basic',
        label: 'Card',
        factory: () => ({
          type: 'card',
          icon: {
            type: 'image',
            image_url: 'https://placehold.co/36x36?text=Icon',
            alt_text: 'Card icon'
          },
          title: { type: 'mrkdwn', text: 'Card title' },
          subtitle: { type: 'mrkdwn', text: 'Card subtitle' },
          body: {
            type: 'mrkdwn',
            text: 'A short description of what this card is about.'
          }
        })
      },
      {
        id: 'card_with_hero',
        label: 'Card with hero image',
        factory: () => ({
          type: 'card',
          hero_image: {
            type: 'image',
            image_url: 'https://placehold.co/400x200?text=Hero',
            alt_text: 'Card hero image'
          },
          title: { type: 'mrkdwn', text: 'Card title' },
          body: {
            type: 'mrkdwn',
            text: 'A short description of what this card is about.'
          }
        })
      },
      {
        id: 'card_with_actions',
        label: 'Card with actions',
        factory: () => ({
          type: 'card',
          title: { type: 'mrkdwn', text: 'Card title' },
          body: {
            type: 'mrkdwn',
            text: 'A short description of what this card is about.'
          },
          actions: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open', emoji: true },
              action_id: 'card_action_1'
            }
          ]
        })
      },
      {
        id: 'carousel_basic',
        label: 'Carousel',
        factory: () => ({
          type: 'carousel',
          elements: [
            {
              type: 'card',
              title: { type: 'mrkdwn', text: 'Card 1' },
              body: { type: 'mrkdwn', text: 'First card in the carousel.' }
            },
            {
              type: 'card',
              title: { type: 'mrkdwn', text: 'Card 2' },
              body: { type: 'mrkdwn', text: 'Second card in the carousel.' }
            },
            {
              type: 'card',
              title: { type: 'mrkdwn', text: 'Card 3' },
              body: { type: 'mrkdwn', text: 'Third card in the carousel.' }
            }
          ]
        })
      }
    ]
  },
  {
    name: 'Table',
    icon: TableIcon,
    variants: [
      {
        id: 'table_simple',
        label: 'Simple table',
        factory: () => ({
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
    ]
  },
  {
    name: 'Data Visualization',
    icon: ChartColumnBig,
    variants: [
      {
        id: 'dataviz_line',
        label: 'Line chart',
        factory: () => ({
          type: 'data_visualization',
          title: 'Weekly active users by platform',
          chart: {
            type: 'line',
            series: [
              {
                name: 'Desktop',
                data: [
                  { label: 'Mon', value: 800 },
                  { label: 'Tue', value: 920 },
                  { label: 'Wed', value: 880 },
                  { label: 'Thu', value: 1010 },
                  { label: 'Fri', value: 1120 }
                ]
              },
              {
                name: 'Mobile',
                data: [
                  { label: 'Mon', value: 400 },
                  { label: 'Tue', value: 530 },
                  { label: 'Wed', value: 500 },
                  { label: 'Thu', value: 590 },
                  { label: 'Fri', value: 600 }
                ]
              }
            ],
            axis_config: {
              categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              x_label: 'Day',
              y_label: 'Users'
            }
          }
        })
      },
      {
        id: 'dataviz_bar',
        label: 'Bar chart',
        factory: () => ({
          type: 'data_visualization',
          title: 'Messages sent by platform',
          chart: {
            type: 'bar',
            series: [
              {
                name: 'Desktop',
                data: [
                  { label: 'Mon', value: 1500 },
                  { label: 'Tue', value: 1400 },
                  { label: 'Wed', value: 1700 },
                  { label: 'Thu', value: 1600 },
                  { label: 'Fri', value: 1280 }
                ]
              },
              {
                name: 'Mobile',
                data: [
                  { label: 'Mon', value: 800 },
                  { label: 'Tue', value: 750 },
                  { label: 'Wed', value: 920 },
                  { label: 'Thu', value: 880 },
                  { label: 'Fri', value: 700 }
                ]
              }
            ],
            axis_config: {
              categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              x_label: 'Day',
              y_label: 'Messages'
            }
          }
        })
      },
      {
        id: 'dataviz_area',
        label: 'Area chart',
        factory: () => ({
          type: 'data_visualization',
          title: 'Concurrent users by platform',
          chart: {
            type: 'area',
            series: [
              {
                name: 'Desktop',
                data: [
                  { label: 'Mon', value: 2800 },
                  { label: 'Tue', value: 3000 },
                  { label: 'Wed', value: 3400 },
                  { label: 'Thu', value: 3200 },
                  { label: 'Fri', value: 3500 }
                ]
              },
              {
                name: 'Mobile',
                data: [
                  { label: 'Mon', value: 1400 },
                  { label: 'Tue', value: 1500 },
                  { label: 'Wed', value: 1700 },
                  { label: 'Thu', value: 1600 },
                  { label: 'Fri', value: 1800 }
                ]
              }
            ],
            axis_config: {
              categories: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              x_label: 'Day',
              y_label: 'Users'
            }
          }
        })
      },
      {
        id: 'dataviz_pie',
        label: 'Pie chart',
        factory: () => ({
          type: 'data_visualization',
          title: 'Plan distribution by tier',
          chart: {
            type: 'pie',
            segments: [
              { label: 'Free', value: 4200 },
              { label: 'Pro', value: 2300 },
              { label: 'Business+', value: 1100 },
              { label: 'Enterprise', value: 480 }
            ]
          }
        })
      }
    ]
  }
] as const;

/**
 * The single-element `input`-block variants that used to ship in
 * `defaultPalette` before it was consolidated to mirror Slack's Block
 * Kit Builder. Kept reachable so consumers who referenced these ids via
 * the `palette` prop can spread them back into a custom palette.
 *
 * @example
 * ```tsx
 * import { defaultPalette, legacyInputVariants } from '@tightknitai/block-kitchen';
 * import { TextCursorInput } from 'lucide-react';
 *
 * const palette = [
 *   ...defaultPalette,
 *   { name: 'All inputs', icon: TextCursorInput, variants: [...legacyInputVariants] }
 * ];
 * ```
 *
 * Note: some ids here (`input_plain_text`, `input_date`, etc.) collide
 * with curated ids in the new `defaultPalette`. `buildVariantById`
 * keeps the last entry for a given id, so spread `legacyInputVariants`
 * after `defaultPalette` to use the legacy factory.
 */
export const legacyInputVariants: readonly PaletteVariant[] = [
  {
    id: 'input_plain_text',
    label: 'plain text',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Label', emoji: true },
      element: {
        type: 'plain_text_input',
        action_id: 'plain_text_input',
        placeholder: {
          type: 'plain_text',
          text: 'Enter some text',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_multiline_text',
    label: 'multiline text',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Description', emoji: true },
      element: {
        type: 'plain_text_input',
        action_id: 'plain_text_input_multiline',
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: 'Enter a longer description',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_email',
    label: 'email',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Email address', emoji: true },
      element: {
        type: 'email_text_input',
        action_id: 'email_text_input',
        placeholder: {
          type: 'plain_text',
          text: 'name@example.com',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_url',
    label: 'url',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Website', emoji: true },
      element: {
        type: 'url_text_input',
        action_id: 'url_text_input',
        placeholder: {
          type: 'plain_text',
          text: 'https://example.com',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_number',
    label: 'number',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Quantity', emoji: true },
      element: {
        type: 'number_input',
        action_id: 'number_input',
        is_decimal_allowed: false,
        placeholder: { type: 'plain_text', text: '0', emoji: true }
      }
    })
  },
  {
    id: 'input_date',
    label: 'date',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick a date', emoji: true },
      element: {
        type: 'datepicker',
        action_id: 'datepicker',
        placeholder: {
          type: 'plain_text',
          text: 'Select a date',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_time',
    label: 'time',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick a time', emoji: true },
      element: {
        type: 'timepicker',
        action_id: 'timepicker',
        placeholder: {
          type: 'plain_text',
          text: 'Select a time',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_datetime',
    label: 'date and time',
    factory: () => ({
      type: 'input',
      label: {
        type: 'plain_text',
        text: 'Pick a date and time',
        emoji: true
      },
      element: {
        type: 'datetimepicker',
        action_id: 'datetimepicker'
      }
    })
  },
  {
    id: 'input_static_select',
    label: 'select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick an option', emoji: true },
      element: {
        type: 'static_select',
        action_id: 'static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Choose one',
          emoji: true
        },
        options: [
          {
            text: { type: 'plain_text', text: 'Option 1', emoji: true },
            value: 'option_1'
          },
          {
            text: { type: 'plain_text', text: 'Option 2', emoji: true },
            value: 'option_2'
          },
          {
            text: { type: 'plain_text', text: 'Option 3', emoji: true },
            value: 'option_3'
          }
        ]
      }
    })
  },
  {
    id: 'input_multi_static_select',
    label: 'multi-select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick options', emoji: true },
      element: {
        type: 'multi_static_select',
        action_id: 'multi_static_select',
        placeholder: {
          type: 'plain_text',
          text: 'Choose one or more',
          emoji: true
        },
        options: [
          {
            text: { type: 'plain_text', text: 'Option 1', emoji: true },
            value: 'option_1'
          },
          {
            text: { type: 'plain_text', text: 'Option 2', emoji: true },
            value: 'option_2'
          },
          {
            text: { type: 'plain_text', text: 'Option 3', emoji: true },
            value: 'option_3'
          }
        ]
      }
    })
  },
  {
    id: 'input_users_select',
    label: 'users select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick a user', emoji: true },
      element: {
        type: 'users_select',
        action_id: 'users_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select a user',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_multi_users_select',
    label: 'multi users select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick users', emoji: true },
      element: {
        type: 'multi_users_select',
        action_id: 'multi_users_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select users',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_channels_select',
    label: 'channels select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick a channel', emoji: true },
      element: {
        type: 'channels_select',
        action_id: 'channels_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select a channel',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_multi_channels_select',
    label: 'multi channels select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick channels', emoji: true },
      element: {
        type: 'multi_channels_select',
        action_id: 'multi_channels_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select channels',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_conversations_select',
    label: 'conversations select',
    factory: () => ({
      type: 'input',
      label: {
        type: 'plain_text',
        text: 'Pick a conversation',
        emoji: true
      },
      element: {
        type: 'conversations_select',
        action_id: 'conversations_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select a conversation',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_multi_conversations_select',
    label: 'multi conversations select',
    factory: () => ({
      type: 'input',
      label: {
        type: 'plain_text',
        text: 'Pick conversations',
        emoji: true
      },
      element: {
        type: 'multi_conversations_select',
        action_id: 'multi_conversations_select',
        placeholder: {
          type: 'plain_text',
          text: 'Select conversations',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_external_select',
    label: 'external select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick an option', emoji: true },
      element: {
        type: 'external_select',
        action_id: 'external_select',
        placeholder: {
          type: 'plain_text',
          text: 'Choose one',
          emoji: true
        },
        min_query_length: 0
      }
    })
  },
  {
    id: 'input_multi_external_select',
    label: 'multi external select',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick options', emoji: true },
      element: {
        type: 'multi_external_select',
        action_id: 'multi_external_select',
        placeholder: {
          type: 'plain_text',
          text: 'Choose one or more',
          emoji: true
        },
        min_query_length: 0
      }
    })
  },
  {
    id: 'input_radio_buttons',
    label: 'radio buttons',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick one', emoji: true },
      element: {
        type: 'radio_buttons',
        action_id: 'radio_buttons',
        options: [
          {
            text: { type: 'plain_text', text: 'Option 1', emoji: true },
            value: 'option_1'
          },
          {
            text: { type: 'plain_text', text: 'Option 2', emoji: true },
            value: 'option_2'
          },
          {
            text: { type: 'plain_text', text: 'Option 3', emoji: true },
            value: 'option_3'
          }
        ]
      }
    })
  },
  {
    id: 'input_checkboxes',
    label: 'checkboxes',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Pick any', emoji: true },
      element: {
        type: 'checkboxes',
        action_id: 'checkboxes',
        options: [
          {
            text: { type: 'plain_text', text: 'Option 1', emoji: true },
            value: 'option_1'
          },
          {
            text: { type: 'plain_text', text: 'Option 2', emoji: true },
            value: 'option_2'
          },
          {
            text: { type: 'plain_text', text: 'Option 3', emoji: true },
            value: 'option_3'
          }
        ]
      }
    })
  },
  {
    id: 'input_rich_text',
    label: 'rich text input',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Description', emoji: true },
      element: {
        type: 'rich_text_input',
        action_id: 'rich_text_input',
        placeholder: {
          type: 'plain_text',
          text: 'Type something',
          emoji: true
        }
      }
    })
  },
  {
    id: 'input_file',
    label: 'file upload',
    factory: () => ({
      type: 'input',
      label: { type: 'plain_text', text: 'Upload a file', emoji: true },
      element: {
        type: 'file_input',
        action_id: 'file_input',
        max_files: 1
      }
    })
  }
] as const;

/**
 * Standalone `alert` block variant. The full set of severity-level alert
 * variants ships in `defaultPalette` under the "Alert" section; this
 * export is retained for backward compatibility with consumers who
 * previously spread it onto a custom palette. Shares the `alert_warning`
 * id with its counterpart in `defaultPalette` — spread after
 * `defaultPalette` (or omit it entirely) to avoid duplicate-id lookups.
 */
export const extraAlertVariant: PaletteVariant = {
  id: 'alert_warning',
  label: 'Warning',
  factory: () => ({
    type: 'alert',
    level: 'warning',
    text: {
      type: 'mrkdwn',
      text: 'Heads up: this action cannot be undone.'
    }
  })
};

/**
 * Builds a lookup table mapping a variant id to its definition for a
 * resolved palette. Used by the DnD drop handler to resolve a
 * `palette:${id}` drag back to a factory.
 * @param sections - the palette in use (defaults or a consumer-provided one)
 * @returns a map keyed by variant id
 */
export function buildVariantById(sections: readonly PaletteSection[]): ReadonlyMap<string, PaletteVariant> {
  return new Map(sections.flatMap((section) => section.variants.map((v) => [v.id, v] as const)));
}

/**
 * Human-readable label for a supported block type. Used in the per-block
 * popover editor heading.
 * @param type - the block type
 * @returns a short label (e.g. "Section")
 */
export function labelForBlockType(type: SupportedBlockType): string {
  switch (type) {
    case 'section':
      return 'Section';
    case 'header':
      return 'Header';
    case 'divider':
      return 'Divider';
    case 'context':
      return 'Context';
    case 'actions':
      return 'Buttons';
    case 'image':
      return 'Image';
    case 'markdown':
      return 'Markdown';
    case 'table':
      return 'Table';
    case 'rich_text':
      return 'Rich Text';
    case 'alert':
      return 'Alert';
    case 'card':
      return 'Card';
    case 'carousel':
      return 'Carousel';
    case 'context_actions':
      return 'Context Actions';
    case 'input':
      return 'Input';
    case 'video':
      return 'Video';
    case 'plan':
      return 'Plan';
    case 'task_card':
      return 'Task Card';
    case 'data_visualization':
      return 'Data Visualization';
  }
}
