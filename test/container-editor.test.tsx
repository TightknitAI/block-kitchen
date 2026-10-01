import { fireEvent, render, screen } from '@testing-library/react';
import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import type { RichTextBlock } from 'slack-web-api-client';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../src/components/editors/block-editor';
import { containerTitleText } from '../src/lib/container-blocks';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import type { ContainerBlock } from '../src/types';

const RICH_TITLE: RichTextBlock = {
  type: 'rich_text',
  elements: [
    {
      type: 'rich_text_section',
      elements: [
        { type: 'text', text: 'Weekly ', style: { bold: true } },
        { type: 'link', url: 'https://example.com/report', text: 'report' },
        { type: 'text', text: ' ' },
        { type: 'emoji', name: 'tada' }
      ]
    }
  ]
};

const child = { type: 'section', text: { type: 'mrkdwn', text: 'All caught up' } } as const;

const container = (fields: Partial<ContainerBlock>): ContainerBlock => ({
  type: 'container',
  child_blocks: [child],
  ...fields
});

function lastChange(onChange: ReturnType<typeof vi.fn>): ContainerBlock {
  return onChange.mock.calls.at(-1)?.[0];
}

function checkbox(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('ContainerEditor rich_text_title', () => {
  it('adds an empty rich text title and keeps the plain title', () => {
    const onChange = vi.fn();
    const title = { type: 'plain_text', text: 'Plain' } as const;
    render(<BlockEditor block={container({ title })} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /add rich text title/i }));

    expect(lastChange(onChange).rich_text_title?.type).toBe('rich_text');
    expect(lastChange(onChange).title).toEqual(title);
  });

  it('drops the plain title when it is cleared while a rich text title is set', () => {
    const onChange = vi.fn();
    render(
      <BlockEditor
        block={container({ title: { type: 'plain_text', text: 'P' }, rich_text_title: RICH_TITLE })}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });

    expect(lastChange(onChange).title).toBeUndefined();
    expect(lastChange(onChange).rich_text_title).toEqual(RICH_TITLE);
  });

  it('keeps an empty plain title when it is cleared without a rich text title', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={container({ title: { type: 'plain_text', text: 'P' } })} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });

    expect(lastChange(onChange).title).toEqual({ type: 'plain_text', text: '' });
  });

  it('restores an empty plain title when the only title, the rich one, is removed', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={container({ rich_text_title: RICH_TITLE })} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove rich text title' }));

    expect(lastChange(onChange).rich_text_title).toBeUndefined();
    expect(lastChange(onChange).title).toEqual({ type: 'plain_text', text: '' });
  });
});

describe('ContainerEditor subtitle format', () => {
  it('keeps a mrkdwn subtitle mrkdwn while its text is edited', () => {
    const onChange = vi.fn();
    render(
      <BlockEditor
        block={container({ title: { type: 'plain_text', text: 'T' }, subtitle: { type: 'mrkdwn', text: '*3*' } })}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText('Subtitle'), { target: { value: '*4* updates' } });

    expect(lastChange(onChange).subtitle).toEqual({ type: 'mrkdwn', text: '*4* updates' });
  });

  it('switches a plain subtitle to mrkdwn', () => {
    const onChange = vi.fn();
    render(
      <BlockEditor
        block={container({ title: { type: 'plain_text', text: 'T' }, subtitle: { type: 'plain_text', text: '*3*' } })}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Markdown' }));

    expect(lastChange(onChange).subtitle).toEqual({ type: 'mrkdwn', text: '*3*' });
  });

  it('hides the format choice until there is a subtitle', () => {
    render(<BlockEditor block={container({ title: { type: 'plain_text', text: 'T' } })} onChange={vi.fn()} />);

    expect(screen.queryByRole('radio', { name: 'Markdown' })).toBeNull();
  });
});

describe('ContainerEditor has_header_divider', () => {
  it('toggles the divider on a non-collapsible container', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={container({ title: { type: 'plain_text', text: 'T' } })} onChange={onChange} />);

    fireEvent.click(checkbox('Header divider'));

    expect(lastChange(onChange).has_header_divider).toBe(true);
  });

  it('disables the divider on a collapsible container', () => {
    render(
      <BlockEditor
        block={container({ title: { type: 'plain_text', text: 'T' }, is_collapsible: true })}
        onChange={vi.fn()}
      />
    );

    expect(checkbox('Header divider').disabled).toBe(true);
  });

  it('clears the divider when the container becomes collapsible', () => {
    const onChange = vi.fn();
    render(
      <BlockEditor
        block={container({ title: { type: 'plain_text', text: 'T' }, has_header_divider: true })}
        onChange={onChange}
      />
    );

    fireEvent.click(checkbox('Collapsible'));

    expect(lastChange(onChange).is_collapsible).toBe(true);
    expect(lastChange(onChange).has_header_divider).toBeUndefined();
  });
});

describe('containerTitleText', () => {
  it('flattens the rich text title, which Slack shows over the plain one', () => {
    expect(
      containerTitleText(container({ title: { type: 'plain_text', text: 'Plain' }, rich_text_title: RICH_TITLE }))
    ).toBe('Weekly report :tada:');
  });

  it('falls back to the plain title when the rich one is empty or absent', () => {
    const empty: RichTextBlock = { type: 'rich_text', elements: [{ type: 'rich_text_section', elements: [] }] };
    expect(
      containerTitleText(container({ title: { type: 'plain_text', text: 'Plain' }, rich_text_title: empty }))
    ).toBe('Plain');
    expect(containerTitleText(container({ title: { type: 'plain_text', text: 'Plain' } }))).toBe('Plain');
  });

  it('reads mentions and list items', () => {
    const rich: RichTextBlock = {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_list',
          style: 'bullet',
          elements: [
            { type: 'rich_text_section', elements: [{ type: 'user', user_id: 'U123' }] },
            { type: 'rich_text_section', elements: [{ type: 'channel', channel_id: 'C456' }] }
          ]
        }
      ]
    };
    expect(containerTitleText(container({ rich_text_title: rich }))).toBe('@U123 #C456');
  });
});

describe('container header fields validate', () => {
  it.each(['message', 'home'] as const)(
    'accepts rich_text_title, mrkdwn subtitle and has_header_divider on %s',
    (surface) => {
      const block = container({
        rich_text_title: RICH_TITLE,
        subtitle: { type: 'mrkdwn', text: '*3* updates' },
        has_header_divider: true
      });

      expect(validateBlockKit(toSlackBlocks([block]), { target: 'blocks', surface }).errors).toEqual([]);
    }
  );
});
