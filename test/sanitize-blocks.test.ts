import { sanitizeBlock, sanitizeBlocks } from '../src/lib/sanitize-blocks';
import type { SupportedBlock } from '../src/types';

describe('sanitizeBlock', () => {
  it('strips javascript: from a section button url', () => {
    const block = {
      type: 'section',
      text: { type: 'mrkdwn', text: 'hi' },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Click' },
        url: 'javascript:alert(1)',
        action_id: 'x'
      }
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as typeof block;
    expect((out.accessory as { url: string }).url).toBe('');
  });

  it('strips javascript: from a rich_text link url', () => {
    const block: SupportedBlock = {
      type: 'rich_text',
      elements: [
        {
          type: 'rich_text_section',
          elements: [{ type: 'link', url: 'javascript:alert(1)', text: 'click me' }]
        }
      ]
    } as SupportedBlock;
    const out = sanitizeBlock(block) as typeof block;
    const link = (out.elements[0] as { elements: { url: string }[] }).elements[0];
    expect(link.url).toBe('');
  });

  it('strips data:image/svg+xml from image_url', () => {
    const block = {
      type: 'image',
      image_url: 'data:image/svg+xml,<svg onload=alert(1)>',
      alt_text: 'evil'
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as typeof block & { image_url: string };
    expect(out.image_url).toBe('');
  });

  it('leaves safe URLs intact', () => {
    const block = {
      type: 'section',
      text: { type: 'mrkdwn', text: 'hi' },
      accessory: {
        type: 'image',
        image_url: 'https://example.com/img.png',
        alt_text: 'pic'
      }
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block);
    expect(out).toBe(block); // reference-stable when nothing changed
  });

  it('returns a new reference only when a URL was rewritten', () => {
    const safe = { type: 'divider' } as SupportedBlock;
    expect(sanitizeBlock(safe)).toBe(safe);

    const unsafe = {
      type: 'image',
      image_url: 'javascript:alert(1)',
      alt_text: 'evil'
    } as unknown as SupportedBlock;
    expect(sanitizeBlock(unsafe)).not.toBe(unsafe);
  });

  it('walks into nested arrays (carousel of cards with bad action urls)', () => {
    const block = {
      type: 'carousel',
      elements: [
        {
          type: 'card',
          actions: [
            { type: 'button', text: { type: 'plain_text', text: 'A' }, url: 'javascript:alert(1)' },
            { type: 'button', text: { type: 'plain_text', text: 'B' }, url: 'https://ok.example.com' }
          ]
        }
      ]
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as typeof block;
    const actions = (out.elements[0] as { actions: { url: string }[] }).actions;
    expect(actions[0].url).toBe('');
    expect(actions[1].url).toBe('https://ok.example.com');
  });
});

describe('video block URL fields', () => {
  // Regression: the sanitizer keyed on an exact-match set of `url` /
  // `image_url`, so every URL field on the video block passed through
  // verbatim and `video_url` reached `<iframe src>` unfiltered.
  const evilVideo = (overrides: Record<string, unknown> = {}): SupportedBlock =>
    ({
      type: 'video',
      alt_text: 'poc',
      title: { type: 'plain_text', text: 'PoC' },
      thumbnail_url: 'javascript:alert(1)',
      video_url: "javascript:top.__pwned='R18-same-origin-XSS'",
      title_url: 'javascript:alert(2)',
      provider_icon_url: 'data:text/html,<script>alert(3)</script>',
      block_id: 'poc',
      ...overrides
    }) as unknown as SupportedBlock;

  it('scrubs javascript: from every URL field on a video block', () => {
    const out = sanitizeBlock(evilVideo()) as unknown as Record<string, string>;
    expect(out.video_url).toBe('');
    expect(out.thumbnail_url).toBe('');
    expect(out.title_url).toBe('');
    expect(out.provider_icon_url).toBe('');
    // Non-URL fields are untouched.
    expect(out.alt_text).toBe('poc');
    expect(out.block_id).toBe('poc');
  });

  it('scrubs data:text/html from video_url — the variant no React version blocks', () => {
    const out = sanitizeBlock(evilVideo({ video_url: 'data:text/html,<script>top.__pwned=1</script>' }));
    expect((out as unknown as { video_url: string }).video_url).toBe('');
  });

  it('holds video_url to http(s) only, where an <a href> would allow more', () => {
    for (const unsafe of ['mailto:a@b.com', 'tel:+15551234', '/relative/page', '//evil.example.com/x']) {
      const out = sanitizeBlock(evilVideo({ video_url: unsafe }));
      expect((out as unknown as { video_url: string }).video_url).toBe('');
    }
  });

  it('leaves a legitimate https video block untouched', () => {
    const block = {
      type: 'video',
      alt_text: 'Product demo',
      title: { type: 'plain_text', text: 'Demo' },
      thumbnail_url: 'https://example.com/thumb.png',
      video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      title_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider_icon_url: 'https://example.com/favicon.png'
    } as unknown as SupportedBlock;
    expect(sanitizeBlock(block)).toBe(block);
  });

  it('still allows a data:image thumbnail, which the embed rule would reject', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const block = {
      type: 'video',
      alt_text: 'ok',
      title: { type: 'plain_text', text: 'ok' },
      thumbnail_url: png,
      video_url: 'https://www.youtube.com/embed/abc'
    } as unknown as SupportedBlock;
    expect((sanitizeBlock(block) as unknown as { thumbnail_url: string }).thumbnail_url).toBe(png);
  });
});

describe('URL keys are matched by name shape, not an exact list', () => {
  // The key set was hand-maintained twice and silently missed a field
  // both times. Any key whose last `_`-delimited segment reads as a URL
  // is sanitized, so a field Slack adds later is covered on arrival.
  it.each(['url', 'image_url', 'thumbnail_url', 'title_url', 'provider_icon_url', 'author_link', 'author_icon_url'])(
    'scrubs an unsafe value at key %p',
    (key) => {
      const block = { type: 'section', [key]: 'javascript:alert(1)' } as unknown as SupportedBlock;
      expect((sanitizeBlock(block) as unknown as Record<string, string>)[key]).toBe('');
    }
  );

  it('classifies a camelCase key the same way as its snake_case form', () => {
    const block = {
      type: 'section',
      videoUrl: 'javascript:alert(1)',
      iconUrl: 'data:text/html,x'
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as unknown as Record<string, string>;
    expect(out.videoUrl).toBe('');
    expect(out.iconUrl).toBe('');
  });

  it('leaves keys that merely contain a URL-ish word alone', () => {
    const block = {
      type: 'section',
      url_label: 'javascript:not-a-url-field',
      source_of_truth: 'javascript:also-not-one'
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as unknown as Record<string, string>;
    expect(out.url_label).toBe('javascript:not-a-url-field');
    expect(out.source_of_truth).toBe('javascript:also-not-one');
  });

  it('passes a non-URL string at a URL-shaped key through untouched', () => {
    const block = { type: 'section', tracking_url: 'not actually a url' } as unknown as SupportedBlock;
    expect(sanitizeBlock(block)).toBe(block);
  });
});

describe('sanitizeBlocks', () => {
  it('returns the same array reference when nothing needs rewriting', () => {
    const blocks: SupportedBlock[] = [{ type: 'divider' }];
    expect(sanitizeBlocks(blocks)).toBe(blocks);
  });

  it('returns a new array when any block was rewritten', () => {
    const blocks = [
      {
        type: 'image',
        image_url: 'javascript:alert(1)',
        alt_text: 'evil'
      }
    ] as unknown as SupportedBlock[];
    expect(sanitizeBlocks(blocks)).not.toBe(blocks);
  });
});

describe('retrieval-only image metadata', () => {
  it('drops send-invalid fields Slack adds to retrieved image blocks', () => {
    const block = {
      type: 'image',
      image_url: 'https://example.com/a.png',
      alt_text: 'ok',
      image_width: 800,
      image_height: 600,
      image_bytes: 12345,
      fallback: '800x600px image',
      is_animated: false
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as Record<string, unknown>;
    for (const k of ['image_width', 'image_height', 'image_bytes', 'fallback', 'is_animated']) {
      expect(Object.hasOwn(out, k)).toBe(false);
    }
    expect(out.image_url).toBe('https://example.com/a.png');
    expect(out.alt_text).toBe('ok');
  });

  it('strips the same fields from a nested image element (e.g. context block)', () => {
    const block = {
      type: 'context',
      elements: [{ type: 'image', image_url: 'https://x/y.gif', alt_text: 'g', is_animated: true, image_bytes: 9 }]
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as { elements: Record<string, unknown>[] };
    expect(Object.hasOwn(out.elements[0], 'is_animated')).toBe(false);
    expect(Object.hasOwn(out.elements[0], 'image_bytes')).toBe(false);
  });

  it('drops preview_images Slack adds to retrieved data_visualization blocks', () => {
    const block = {
      type: 'data_visualization',
      title: 'Weekly active users',
      chart: { type: 'line', series: [] },
      preview_images: [{ url: 'https://slack.example/chart.png' }]
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as Record<string, unknown>;
    expect(Object.hasOwn(out, 'preview_images')).toBe(false);
    expect(out.title).toBe('Weekly active users');
    expect(out.chart).toBeDefined();
  });

  it('leaves preview_images untouched on non-data_visualization objects', () => {
    const block = {
      type: 'section',
      text: { type: 'mrkdwn', text: 'hi' },
      preview_images: ['keep me']
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as Record<string, unknown>;
    expect(out.preview_images).toEqual(['keep me']);
    expect(out).toBe(block);
  });

  it('leaves the same field names untouched on non-image objects', () => {
    const block = {
      type: 'section',
      text: { type: 'mrkdwn', text: 'hi' },
      fallback: 'keep me',
      is_animated: true
    } as unknown as SupportedBlock;
    const out = sanitizeBlock(block) as Record<string, unknown>;
    expect(out.fallback).toBe('keep me');
    expect(out.is_animated).toBe(true);
    expect(out).toBe(block);
  });
});

describe('prototype pollution shape', () => {
  it('a JSON object with __proto__ key does not pollute Object.prototype', () => {
    const parsed = JSON.parse('{"__proto__": {"polluted": true}}');
    // Modern engines treat `__proto__` in JSON as a plain own property
    // (it does NOT mutate the prototype). Our sanitizer should preserve
    // that behavior — no merge that walks the prototype chain.
    const sanitized = sanitizeBlock(parsed as SupportedBlock);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(sanitized, '__proto__')).toBe(true);
  });
});
