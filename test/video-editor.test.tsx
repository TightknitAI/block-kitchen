import { fireEvent, render, screen } from '@testing-library/react';
import { BlockEditor } from '../src/components/editors/block-editor';
import type { VideoBlock } from '../src/types';

const VIDEO_BLOCK: VideoBlock = {
  type: 'video',
  alt_text: 'Product demo',
  title: { type: 'plain_text', text: 'Demo', emoji: true },
  thumbnail_url: 'https://example.com/thumb.png',
  video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
  block_id: 'vid_1'
};

function input(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

describe('VideoEditor URL validation', () => {
  it('flags nothing on a block whose URLs are all safe', () => {
    render(<BlockEditor block={VIDEO_BLOCK} onChange={vi.fn()} />);

    for (const label of ['Video URL', 'Thumbnail URL', 'Title link URL', 'Provider icon URL']) {
      expect(input(label).getAttribute('aria-invalid')).toBeNull();
    }
  });

  it.each([
    ['Video URL', 'video_url'],
    ['Thumbnail URL', 'thumbnail_url'],
    ['Title link URL', 'title_url'],
    ['Provider icon URL', 'provider_icon_url']
  ])('marks %s invalid when it carries a javascript: URL', (label, key) => {
    render(<BlockEditor block={{ ...VIDEO_BLOCK, [key]: 'javascript:alert(1)' }} onChange={vi.fn()} />);

    expect(input(label).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText(/will be stripped before send and preview/).length).toBeGreaterThan(0);
  });

  // `video_url` lands in an `<iframe src>`, so it is held to http(s)
  // only — stricter than the link allowlist the title link gets.
  it('flags a mailto video URL but not a mailto title link', () => {
    const { unmount } = render(
      <BlockEditor block={{ ...VIDEO_BLOCK, video_url: 'mailto:a@b.com' }} onChange={vi.fn()} />
    );
    expect(input('Video URL').getAttribute('aria-invalid')).toBe('true');
    unmount();

    render(<BlockEditor block={{ ...VIDEO_BLOCK, title_url: 'mailto:a@b.com' }} onChange={vi.fn()} />);
    expect(input('Title link URL').getAttribute('aria-invalid')).toBeNull();
  });

  it('clears the warning once the URL is corrected', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BlockEditor block={{ ...VIDEO_BLOCK, video_url: 'javascript:alert(1)' }} onChange={onChange} />
    );
    expect(input('Video URL').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(input('Video URL'), { target: { value: 'https://vimeo.com/embed/1' } });
    expect(onChange).toHaveBeenCalledWith({ ...VIDEO_BLOCK, video_url: 'https://vimeo.com/embed/1' });

    rerender(<BlockEditor block={{ ...VIDEO_BLOCK, video_url: 'https://vimeo.com/embed/1' }} onChange={onChange} />);
    expect(input('Video URL').getAttribute('aria-invalid')).toBeNull();
  });

  it('leaves an empty optional URL unflagged', () => {
    render(<BlockEditor block={{ ...VIDEO_BLOCK, title_url: '' }} onChange={vi.fn()} />);

    expect(input('Title link URL').getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(/will be stripped before send and preview/)).toBeNull();
  });
});
