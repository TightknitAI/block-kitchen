import { render } from '@testing-library/react';
import { SlackBlockPreview } from '../src/components/preview/slack-block-preview';
import type { SupportedBlock } from '../src/types';

/**
 * Exercises the preview's post-render DOM scrub on its own. The payload
 * sanitizer drops the `iframeProps` bag before the renderer sees it, so
 * with it in place nothing here would ever reach the DOM; it is mocked
 * to a pass-through so the scrub has to do the work.
 */
vi.mock('../src/lib/sanitize-blocks', () => ({
  sanitizeBlock: <T,>(block: T): T => block
}));

const videoWith = (iframeProps: Record<string, unknown>): SupportedBlock =>
  ({
    type: 'video',
    alt_text: 'poc',
    title: { type: 'plain_text', text: 'PoC' },
    thumbnail_url: 'https://example.com/thumb.png',
    video_url: 'https://www.youtube.com/embed/abc',
    iframeProps
  }) as unknown as SupportedBlock;

describe('SlackBlockPreview DOM scrub (payload sanitizer bypassed)', () => {
  it('strips srcdoc from a frame the renderer emitted with one', () => {
    const { container } = render(<SlackBlockPreview block={videoWith({ srcdoc: '<script>top.__pwned=1</script>' })} />);
    const iframe = container.querySelector('iframe');
    expect(iframe?.hasAttribute('srcdoc')).toBe(false);
    expect(iframe?.getAttribute('data-bk-blocked-srcdoc')).toBe('1');
    // The legitimate source is untouched.
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc');
  });

  it('strips a non-http(s) src override on the same frame', () => {
    const { container } = render(
      <SlackBlockPreview block={videoWith({ src: 'data:text/html,<script>top.__pwned=1</script>' })} />
    );
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src') ?? '').toBe('');
    expect(iframe?.getAttribute('data-bk-blocked-src')).toBe('1');
  });

  it('leaves a frame without srcdoc unmarked', () => {
    const { container } = render(<SlackBlockPreview block={videoWith({})} />);
    const iframe = container.querySelector('iframe');
    expect(iframe?.hasAttribute('data-bk-blocked-srcdoc')).toBe(false);
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/abc');
  });
});
