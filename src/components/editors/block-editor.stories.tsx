import type { Meta, StoryObj } from '@storybook/react-vite';
import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { TextCursorInput } from 'lucide-react';
import { useArgs } from 'storybook/preview-api';
import { expect, fn, userEvent, within } from 'storybook/test';
import { buildVariantById, defaultPalette, extraAlertVariant, legacyInputVariants } from '../../lib/default-blocks';
import { toSlackBlocks } from '../../lib/to-slack-blocks';
import { TooltipProvider } from '../../lib/ui/tooltip';
import type { SupportedBlock } from '../../types';
import { BlockEditor } from './block-editor';

/**
 * Pulls the most recent `onChange` payload from a Vitest spy and asserts
 * the resulting block validates as Slack Block Kit. Play tests use this
 * to catch the case where a field edit produces a structurally-correct
 * React state but a payload Slack would reject on send.
 */
function expectLastOnChangeIsValid(onChange: ReturnType<typeof fn>): SupportedBlock {
  const calls = onChange.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const latest = calls[calls.length - 1][0] as SupportedBlock;
  const result = validateBlockKit(toSlackBlocks([latest]), { target: 'blocks' });
  if (!result.valid) {
    throw new Error(`Edited block failed validation:\n${result.errors.join('\n')}`);
  }
  return latest;
}

// Stories cover every editor code path — including element types that
// only live in `legacyInputVariants` (single/multi users-select, the
// individual datepicker/timepicker/datetimepicker inputs, etc.) and
// the alert variant that was dropped from the default palette. Stitch
// them into a story-only lookup so each story can still resolve its
// payload by id.
const VARIANT_BY_ID = buildVariantById([
  ...defaultPalette,
  {
    name: '_storybook_legacy',
    icon: TextCursorInput,
    variants: [...legacyInputVariants, extraAlertVariant]
  }
]);

/**
 * Resolves a palette variant id to a fresh block payload, so stories
 * track the same defaults the palette inserts at runtime.
 */
function variant(id: string): SupportedBlock {
  const v = VARIANT_BY_ID.get(id);
  if (!v) {
    throw new Error(`Unknown palette variant: ${id}`);
  }
  return v.factory();
}

const meta = {
  title: 'BlockKitchen/BlockEditor',
  component: BlockEditor,
  parameters: {
    layout: 'centered',
    // The editor renders many native form controls (e.g. radio groups,
    // number inputs) inside a popover-style surface; axe occasionally
    // flags low-contrast affordances depending on the active theme. Run
    // a11y checks against the live builder story for the integrated view.
    a11y: { test: 'todo' }
  },
  args: { onChange: fn() },
  // Render via a hook so the editor is interactive: edits in the form
  // flow back into `args.block` and re-render the story, while also
  // invoking the spy on `args.onChange` so play functions can assert.
  render: function BlockEditorStoryRender(args) {
    const [{ block }, updateArgs] = useArgs<{ block: SupportedBlock }>();
    return (
      <BlockEditor
        block={block}
        errors={args.errors}
        onChange={(next) => {
          args.onChange?.(next);
          updateArgs({ block: next });
        }}
      />
    );
  },
  decorators: [
    (Story) => (
      <TooltipProvider delayDuration={200}>
        <div className="bk-root w-[32rem] max-h-[80vh] overflow-y-auto rounded-md border bg-popover p-4 text-popover-foreground shadow-md">
          <Story />
        </div>
      </TooltipProvider>
    )
  ]
} satisfies Meta<typeof BlockEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ----------------------------- Per-block-type ----------------------------- */

export const Section: Story = {
  args: { block: variant('section_mrkdwn') }
};

export const SectionWithButtonAccessory: Story = {
  args: { block: variant('section_with_button') }
};

export const SectionWithImageAccessory: Story = {
  args: { block: variant('section_with_image') }
};

export const Header: Story = {
  args: { block: variant('structure_header') }
};

export const Divider: Story = {
  args: { block: variant('structure_divider') }
};

export const Context: Story = {
  args: { block: variant('structure_context_text_images') }
};

// The actions editor only supports button elements today, so this
// story exercises the multi-button code path directly. It used to
// come from a palette variant; the new palette has a single
// "Button" entry, but the multi-button editor flow still needs
// coverage.
export const Actions: Story = {
  args: {
    block: {
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
    }
  }
};

export const Image: Story = {
  args: { block: variant('image_with_title') }
};

export const Markdown: Story = {
  args: { block: variant('markdown_list') }
};

export const RichText: Story = {
  args: { block: variant('rich_text_section') }
};

export const Table: Story = {
  args: { block: variant('table_simple') }
};

export const Alert: Story = {
  args: { block: variant('alert_warning') }
};

export const Card: Story = {
  args: { block: variant('card_with_hero') }
};

export const Carousel: Story = {
  args: { block: variant('carousel_basic') }
};

export const ContextActions: Story = {
  args: { block: variant('agents_feedback_remove') }
};

// Two stories so the catalog covers both data-visualization editor paths:
// the category × series grid (line / bar / area share it) and the flat
// segment list (pie).
export const DataVisualizationLine: Story = {
  args: { block: variant('dataviz_line') }
};

export const DataVisualizationPie: Story = {
  args: { block: variant('dataviz_pie') }
};

/* ----------------------------- Input variants ----------------------------- */

// Input is the block with the widest sub-editor surface area: 20+ element
// types, each rendering a different combination of action_id, placeholder,
// initial value, options list, max-selected, etc. One story per element
// type so the catalog covers every code path in input-editor.tsx.

export const InputPlainText: Story = {
  args: { block: variant('input_plain_text') }
};

export const InputMultilineText: Story = {
  args: { block: variant('input_multiline_text') }
};

export const InputEmail: Story = {
  args: { block: variant('input_email') }
};

export const InputURL: Story = {
  args: { block: variant('input_url') }
};

export const InputNumber: Story = {
  args: { block: variant('input_number') }
};

export const InputDate: Story = {
  args: { block: variant('input_date') }
};

export const InputTime: Story = {
  args: { block: variant('input_time') }
};

export const InputDateTime: Story = {
  args: { block: variant('input_datetime') }
};

export const InputStaticSelect: Story = {
  args: { block: variant('input_static_select') }
};

export const InputMultiStaticSelect: Story = {
  args: { block: variant('input_multi_static_select') }
};

export const InputUsersSelect: Story = {
  args: { block: variant('input_users_select') }
};

export const InputMultiUsersSelect: Story = {
  args: { block: variant('input_multi_users_select') }
};

export const InputChannelsSelect: Story = {
  args: { block: variant('input_channels_select') }
};

export const InputMultiChannelsSelect: Story = {
  args: { block: variant('input_multi_channels_select') }
};

export const InputConversationsSelect: Story = {
  args: { block: variant('input_conversations_select') }
};

export const InputMultiConversationsSelect: Story = {
  args: { block: variant('input_multi_conversations_select') }
};

export const InputExternalSelect: Story = {
  args: { block: variant('input_external_select') }
};

export const InputMultiExternalSelect: Story = {
  args: { block: variant('input_multi_external_select') }
};

export const InputRadioButtons: Story = {
  args: { block: variant('input_radio_buttons') }
};

export const InputCheckboxes: Story = {
  args: { block: variant('input_checkboxes') }
};

export const InputRichText: Story = {
  args: { block: variant('input_rich_text') }
};

export const InputFile: Story = {
  args: { block: variant('input_file') }
};

/* ---------------------------- Validation state ---------------------------- */

export const WithValidationErrors: Story = {
  args: {
    block: { type: 'header', text: { type: 'plain_text', text: '', emoji: true } },
    errors: ['Header text is required.', 'Header text cannot be empty.']
  }
};

/* ------------------------------ Interaction ------------------------------ */

export const TypingSectionTextInvokesOnChange: Story = {
  args: { block: variant('section_mrkdwn') },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByLabelText(/^text$/i);
    await userEvent.click(textarea);
    await userEvent.keyboard(' Edited.');
    await expect(args.onChange).toHaveBeenCalled();
    expectLastOnChangeIsValid(args.onChange as ReturnType<typeof fn>);
  }
};

export const TypingHeaderTextProducesValidBlock: Story = {
  args: { block: variant('structure_header') },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const input = await canvas.findByLabelText(/heading text/i);
    await userEvent.click(input);
    await userEvent.keyboard(' (edited)');
    await expect(args.onChange).toHaveBeenCalled();
    const latest = expectLastOnChangeIsValid(args.onChange as ReturnType<typeof fn>);
    expect(latest.type).toBe('header');
  }
};

export const TypingMarkdownTextProducesValidBlock: Story = {
  args: { block: variant('markdown_list') },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const textarea = await canvas.findByLabelText(/^markdown$/i);
    await userEvent.click(textarea);
    await userEvent.keyboard('\n- Added line');
    await expect(args.onChange).toHaveBeenCalled();
    const latest = expectLastOnChangeIsValid(args.onChange as ReturnType<typeof fn>);
    expect(latest.type).toBe('markdown');
  }
};

export const EditingImageUrlAndAltProducesValidBlock: Story = {
  args: { block: variant('image_with_title') },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const url = await canvas.findByLabelText(/image url/i);
    await userEvent.clear(url);
    await userEvent.type(url, 'https://example.com/new.png');
    const alt = await canvas.findByLabelText(/alt text/i);
    await userEvent.clear(alt);
    await userEvent.type(alt, 'New cover');
    await expect(args.onChange).toHaveBeenCalled();
    const latest = expectLastOnChangeIsValid(args.onChange as ReturnType<typeof fn>);
    expect(latest.type).toBe('image');
  }
};
