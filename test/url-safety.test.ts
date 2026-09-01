import {
  hasExplicitSafeScheme,
  isSafeEmbedSrc,
  isSafeHref,
  isSafeImageSrc,
  sanitizeEmbedSrc,
  sanitizeHref,
  sanitizeImageSrc
} from '../src/lib/url-safety';

describe('isSafeHref', () => {
  it.each([
    'https://example.com',
    'http://example.com/path?q=1#frag',
    'mailto:foo@example.com',
    'tel:+1234567890',
    'sms:+1234567890',
    'xmpp:user@server',
    'ircs://irc.example.com/channel',
    '/relative/path',
    './sibling',
    '../parent',
    '#anchor',
    '?query=only',
    'relative-no-scheme',
    ''
  ])('accepts safe href %p', (input) => {
    expect(isSafeHref(input)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    ' javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'javascript:void(0)',
    '\tjavascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank',
    'chrome://settings',
    'view-source:https://example.com',
    // Unknown schemes are rejected by allowlist (e.g. browsers treat
    // `path:foo` as having scheme `path`, not as a relative path).
    'path:with:colons/in/segment'
  ])('rejects unsafe href %p', (input) => {
    expect(isSafeHref(input)).toBe(false);
  });

  it.each([null, undefined, 0, false, {}, [], 42])('rejects non-string %p', (input) => {
    expect(isSafeHref(input as unknown as string)).toBe(false);
  });
});

describe('isSafeImageSrc', () => {
  it.each([
    'https://example.com/cat.png',
    'http://example.com/cat.jpg',
    '/relative/cat.gif',
    '',
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    'data:image/jpeg;base64,/9j/2wBDAA=='
  ])('accepts safe image src %p', (input) => {
    expect(isSafeImageSrc(input)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'data:application/javascript,alert(1)',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com/cat.png'
  ])('rejects unsafe image src %p', (input) => {
    expect(isSafeImageSrc(input)).toBe(false);
  });
});

describe('isSafeEmbedSrc (iframe / subresource sources)', () => {
  it.each(['https://www.youtube.com/embed/abc', 'http://example.com/player?v=1', ''])(
    'accepts safe embed src %p',
    (input) => {
      expect(isSafeEmbedSrc(input)).toBe(true);
    }
  );

  it.each([
    'javascript:alert(1)',
    ' javascript:top.__pwned=1',
    'JaVaScRiPt:alert(1)',
    // The variant no React version blocks: renders and executes in an
    // opaque origin.
    'data:text/html,<script>alert(1)</script>',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    // A `data:image/*` payload is fine in an `<img>` but has no business
    // being framed, so the embed allowlist is tighter than the image one.
    'data:image/png;base64,iVBORw0KGgo=',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank',
    'ftp://example.com/clip.mp4',
    // Unlike hrefs and image sources, a relative URL is NOT safe here: it
    // frames a page of the embedding app itself.
    '/relative/page',
    './sibling',
    '//protocol-relative.example.com/x',
    'relative-no-scheme',
    // Link schemes that are harmless to click but meaningless to frame.
    'mailto:foo@example.com',
    'tel:+1234567890'
  ])('rejects unsafe embed src %p', (input) => {
    expect(isSafeEmbedSrc(input)).toBe(false);
  });

  it.each([null, undefined, 0, false, {}, [], 42])('rejects non-string %p', (input) => {
    expect(isSafeEmbedSrc(input as unknown as string)).toBe(false);
  });
});

describe('hasExplicitSafeScheme (autolink gate)', () => {
  it.each([
    'https://example.com',
    'http://example.com/path?q=1',
    'HTTPS://EXAMPLE.COM',
    'mailto:foo@example.com',
    'tel:+1234567890',
    'sms:+1234567890',
    'xmpp:user@server'
  ])('auto-links explicit safe scheme %p', (input) => {
    expect(hasExplicitSafeScheme(input)).toBe(true);
  });

  it.each([
    // Bare host-like tokens must not auto-link just because the suffix is
    // a real gTLD — this is the ENG-4850 regression.
    '2.xyz',
    'report.zip',
    'logo.png',
    'example.com',
    'www.example.com',
    'foo@example.com',
    'config.dev',
    'v2.api',
    // Relative / fragment / empty are never autolinked.
    '/relative/path',
    './sibling',
    '#anchor',
    ''
  ])('does not auto-link bare/relative token %p', (input) => {
    expect(hasExplicitSafeScheme(input)).toBe(false);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'ftp://example.com',
    'vbscript:msgbox(1)',
    'file:///etc/passwd'
  ])('does not auto-link unsafe scheme %p', (input) => {
    expect(hasExplicitSafeScheme(input)).toBe(false);
  });

  it.each([null, undefined, 42, {}])('rejects non-string %p', (input) => {
    expect(hasExplicitSafeScheme(input as unknown as string)).toBe(false);
  });
});

describe('sanitize*', () => {
  it('sanitizeHref returns the URL when safe', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
  });

  it('sanitizeHref returns empty string when unsafe', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBe('');
  });

  it('sanitizeImageSrc returns the URL when safe', () => {
    expect(sanitizeImageSrc('https://example.com/cat.png')).toBe('https://example.com/cat.png');
  });

  it('sanitizeImageSrc returns empty string when unsafe', () => {
    expect(sanitizeImageSrc('data:image/svg+xml,<svg onload=alert(1)>')).toBe('');
  });

  it('sanitizeEmbedSrc returns the URL when safe', () => {
    expect(sanitizeEmbedSrc('https://www.youtube.com/embed/abc')).toBe('https://www.youtube.com/embed/abc');
  });

  it('sanitizeEmbedSrc returns empty string when unsafe', () => {
    expect(sanitizeEmbedSrc('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeEmbedSrc('javascript:alert(1)')).toBe('');
  });

  it('sanitizeHref preserves an empty string', () => {
    expect(sanitizeHref('')).toBe('');
  });

  it('sanitizeHref converts null/undefined to empty string', () => {
    expect(sanitizeHref(null)).toBe('');
    expect(sanitizeHref(undefined)).toBe('');
  });
});
