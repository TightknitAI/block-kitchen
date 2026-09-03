import { render } from '@testing-library/react';
import { SlackBlockPreview } from '../src/components/preview/slack-block-preview';
import type { SupportedBlock } from '../src/types';

/**
 * Whole-DOM regression net for the preview boundary.
 *
 * Two rounds of URL-sanitizer hardening each covered the URL fields
 * known at the time and each missed one Slack had added — anchors and
 * images were scrubbed while the video block's `video_url` reached
 * `<iframe src>` untouched. Rather than assert on the fields we happen
 * to know about, these tests render hostile payloads and then walk
 * everything the renderer produced, asserting that no element that
 * navigates or auto-loads carries anything but an http(s) URL.
 *
 * A future renderer upgrade that starts emitting a new URL-bearing tag,
 * or a Slack block that adds a new URL field, fails here.
 */

/** Every attribute the browser will resolve as a URL, by tag. */
const URL_ATTRS: Record<string, string[]> = {
  A: ['href'],
  AREA: ['href'],
  IMG: ['src', 'srcset'],
  IFRAME: ['src', 'srcdoc'],
  EMBED: ['src'],
  OBJECT: ['data'],
  SOURCE: ['src', 'srcset'],
  VIDEO: ['src', 'poster'],
  AUDIO: ['src'],
  TRACK: ['src'],
  SCRIPT: ['src'],
  LINK: ['href'],
  FORM: ['action'],
  BUTTON: ['formaction'],
  INPUT: ['formaction', 'src']
};

/** A URL that cannot execute script or frame the embedding app. */
function isInert(value: string): boolean {
  // Empty, `#`, and a removed attribute are all no-ops; anything else
  // must be an explicit http(s) URL.
  return value === '' || value === '#' || /^https?:\/\//i.test(value);
}

/**
 * Collects every URL-bearing attribute the render produced that is not
 * inert, as `tag[attr]="value"` strings for a readable failure message.
 * @param root - the rendered container
 * @returns the offending attributes, empty when the DOM is clean
 */
function unsafeUrlAttributes(root: HTMLElement): string[] {
  const found: string[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    for (const attr of URL_ATTRS[el.tagName] ?? []) {
      const value = el.getAttribute(attr);
      if (value !== null && !isInert(value)) {
        found.push(`${el.tagName.toLowerCase()}[${attr}]=${JSON.stringify(value)}`);
      }
    }
  }
  return found;
}

const HOSTILE_URLS = [
  "javascript:top.__pwned='R18-same-origin-XSS'",
  'data:text/html,<script>top.__pwned_data=1</script>',
  'vbscript:msgbox(1)',
  'file:///etc/passwd'
];

const hostileVideo = (url: string): SupportedBlock =>
  ({
    type: 'video',
    alt_text: 'poc',
    title: { type: 'plain_text', text: 'PoC' },
    thumbnail_url: url,
    video_url: url,
    title_url: url,
    provider_icon_url: url,
    provider_name: 'Evil',
    author_name: 'Evil',
    description: { type: 'plain_text', text: 'poc' },
    block_id: 'poc'
  }) as unknown as SupportedBlock;

describe('SlackBlockPreview renders no executable URL', () => {
  it.each(HOSTILE_URLS)('scrubs every URL field of a video block carrying %p', (url) => {
    const { container } = render(<SlackBlockPreview block={hostileVideo(url)} />);
    expect(unsafeUrlAttributes(container)).toEqual([]);
  });

  it('leaves the video iframe pointed at about:blank rather than a hostile URL', () => {
    const { container } = render(<SlackBlockPreview block={hostileVideo('data:text/html,<script>1</script>')} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    // Absent or empty — the HTML spec loads about:blank for both, and
    // which one React leaves behind for an empty `src` prop varies by
    // major version.
    expect(iframe?.getAttribute('src') ?? '').toBe('');
  });

  it('renders a legitimate https video block unchanged', () => {
    const block = {
      type: 'video',
      alt_text: 'Product demo',
      title: { type: 'plain_text', text: 'Demo' },
      thumbnail_url: 'https://example.com/thumb.png',
      video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      title_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider_icon_url: 'https://example.com/favicon.png',
      provider_name: 'YouTube'
    } as unknown as SupportedBlock;

    const { container } = render(<SlackBlockPreview block={block} />);

    expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(unsafeUrlAttributes(container)).toEqual([]);
  });

  // `slack-blocks-to-jsx` spreads a video block's `iframeProps` onto the
  // `<iframe>` after its own `src`. It is not a Slack field, so nothing in
  // it may reach the frame: not `srcdoc` (an inline document runs in the
  // embedding app's origin), not a `src` override, not a loosened
  // `sandbox` or `allow`. The legitimate `video_url` must survive, so the
  // bag is discarded rather than clobbering the frame it was aimed at.
  const LEGIT_EMBED = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  const withIframeProps = (iframeProps: Record<string, unknown>): SupportedBlock =>
    ({
      type: 'video',
      alt_text: 'poc',
      title: { type: 'plain_text', text: 'PoC' },
      thumbnail_url: 'https://example.com/thumb.png',
      video_url: LEGIT_EMBED,
      iframeProps
    }) as unknown as SupportedBlock;

  it.each([
    { srcdoc: '<script>top.__pwned=1</script>' },
    { srcDoc: '<script>top.__pwned=1</script>' },
    { src: 'data:text/html,<script>top.__pwned=1</script>' },
    { src: 'javascript:top.__pwned=1' },
    { src: '/admin' },
    { sandbox: 'allow-scripts allow-same-origin', allow: 'camera; microphone' }
  ])('renders a video block carrying iframeProps %j as if the bag were absent', (iframeProps) => {
    const { container } = render(<SlackBlockPreview block={withIframeProps(iframeProps)} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(unsafeUrlAttributes(container)).toEqual([]);
    expect(iframe?.getAttribute('src')).toBe(LEGIT_EMBED);
    for (const attr of ['srcdoc', 'sandbox', 'allow']) {
      expect(iframe?.hasAttribute(attr)).toBe(false);
    }
  });

  it.each(HOSTILE_URLS)('scrubs mrkdwn and rich-text links carrying %p', (url) => {
    const blocks: SupportedBlock[] = [
      { type: 'section', text: { type: 'mrkdwn', text: `[click](${url}) and <${url}|label>` } },
      {
        type: 'rich_text',
        elements: [{ type: 'rich_text_section', elements: [{ type: 'link', url, text: 'click me' }] }]
      } as unknown as SupportedBlock,
      { type: 'image', image_url: url, alt_text: 'evil' } as unknown as SupportedBlock,
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'hi' },
        accessory: { type: 'button', text: { type: 'plain_text', text: 'Go' }, url, action_id: 'a' }
      } as unknown as SupportedBlock
    ];

    for (const block of blocks) {
      const { container } = render(<SlackBlockPreview block={block} />);
      expect(unsafeUrlAttributes(container)).toEqual([]);
    }
  });
});
