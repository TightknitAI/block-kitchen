import { fireEvent, render, screen } from '@testing-library/react';
import type { ImageBlock } from 'slack-web-api-client';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../src/components/editors/block-editor';

const SLACK_FILE_BLOCK: ImageBlock = {
  type: 'image',
  slack_file: { id: 'F0123456789' },
  alt_text: 'Quarterly chart',
  title: { type: 'plain_text', text: 'Q2', emoji: true },
  block_id: 'img_1'
};

const URL_BLOCK: ImageBlock = {
  type: 'image',
  image_url: 'https://example.com/cover.png',
  alt_text: 'Cover'
};

function radio(name: string): HTMLElement {
  return screen.getByRole('radio', { name });
}

function input(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('ImageEditor source switching', () => {
  it('shows a URL-backed block with the Public URL source selected', () => {
    render(<BlockEditor block={URL_BLOCK} onChange={vi.fn()} />);

    expect(radio('Public URL').getAttribute('aria-checked')).toBe('true');
    expect(input('Image URL').value).toBe('https://example.com/cover.png');
  });

  it('makes a slack_file-backed block editable, with the Slack file source selected', () => {
    render(<BlockEditor block={SLACK_FILE_BLOCK} onChange={vi.fn()} />);

    expect(radio('Slack file').getAttribute('aria-checked')).toBe('true');
    expect(input('File ID').value).toBe('F0123456789');
    expect(input('File URL').value).toBe('');
    expect(input('Alt text').value).toBe('Quarterly chart');
    expect(input('Title (optional)').value).toBe('Q2');
  });

  it('switching to Public URL drops the slack_file backing but keeps everything else', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={SLACK_FILE_BLOCK} onChange={onChange} />);

    fireEvent.click(radio('Public URL'));

    expect(onChange).toHaveBeenCalledWith({
      type: 'image',
      image_url: '',
      alt_text: 'Quarterly chart',
      title: { type: 'plain_text', text: 'Q2', emoji: true },
      block_id: 'img_1'
    });
    expect('slack_file' in onChange.mock.calls[0][0]).toBe(false);
  });

  it('switching to Slack file drops image_url and starts from an empty file id', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={URL_BLOCK} onChange={onChange} />);

    fireEvent.click(radio('Slack file'));

    expect(onChange).toHaveBeenCalledWith({
      type: 'image',
      slack_file: { id: '' },
      alt_text: 'Cover'
    });
    expect('image_url' in onChange.mock.calls[0][0]).toBe(false);
  });

  it('edits the slack file id', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={SLACK_FILE_BLOCK} onChange={onChange} />);

    fireEvent.change(input('File ID'), { target: { value: 'F9876543210' } });

    expect(onChange).toHaveBeenCalledWith({ ...SLACK_FILE_BLOCK, slack_file: { id: 'F9876543210' } });
  });

  it('entering a file URL replaces the file id reference', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={SLACK_FILE_BLOCK} onChange={onChange} />);

    fireEvent.change(input('File URL'), {
      target: { value: 'https://files.slack.com/files-pri/T0123-F0123/image.png' }
    });

    expect(onChange).toHaveBeenCalledWith({
      ...SLACK_FILE_BLOCK,
      slack_file: { url: 'https://files.slack.com/files-pri/T0123-F0123/image.png' }
    });
  });

  it('keeps alt text and title editable on a slack_file block', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={SLACK_FILE_BLOCK} onChange={onChange} />);

    fireEvent.change(input('Alt text'), { target: { value: 'Updated alt' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...SLACK_FILE_BLOCK, alt_text: 'Updated alt' });

    fireEvent.change(input('Title (optional)'), { target: { value: 'New title' } });
    expect(onChange).toHaveBeenLastCalledWith({
      ...SLACK_FILE_BLOCK,
      title: { type: 'plain_text', text: 'New title', emoji: true }
    });
  });

  it('still edits the image URL on a URL-backed block', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={URL_BLOCK} onChange={onChange} />);

    fireEvent.change(input('Image URL'), { target: { value: 'https://example.com/new.png' } });

    expect(onChange).toHaveBeenCalledWith({ ...URL_BLOCK, image_url: 'https://example.com/new.png' });
  });
});
