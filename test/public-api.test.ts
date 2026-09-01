import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { BlockKitchen, SendDialog, SlackSignInButton, TemplatePicker, useSlackSignIn } from '../src/index';
import { defaultPalette, extraAlertVariant, legacyInputVariants } from '../src/lib/default-blocks';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import { decodeBlocksFromString, encodeBlocksToString } from '../src/lib/url-state';
import type { SupportedBlock } from '../src/types';

describe('toSlackBlocks', () => {
  // Regression: `level` is a real Slack header field (integer 1-4), not a
  // builder-only extension. It used to be stripped here, which silently
  // dropped the heading level from every message the builder sent.
  it('preserves the `level` field on header blocks', () => {
    const input: SupportedBlock[] = [
      {
        type: 'header',
        level: 2,
        text: { type: 'plain_text', text: 'Heading', emoji: true }
      } as SupportedBlock
    ];

    const [out] = toSlackBlocks(input);
    expect(out.type).toBe('header');
    expect(out).toEqual(input[0]);
  });

  it('emits header `level` in a payload the validator accepts', () => {
    for (const level of [1, 2, 3, 4]) {
      const payload = toSlackBlocks([
        {
          type: 'header',
          level,
          text: { type: 'plain_text', text: 'Heading', emoji: true }
        } as SupportedBlock
      ]);
      expect(payload[0]).toHaveProperty('level', level);
      expect(validateBlockKit(payload, { target: 'blocks' }).valid).toBe(true);
    }
  });

  it('leaves an out-of-range header `level` intact so it surfaces as a validation error', () => {
    const payload = toSlackBlocks([
      {
        type: 'header',
        level: 6,
        text: { type: 'plain_text', text: 'Heading', emoji: true }
      } as unknown as SupportedBlock
    ]);
    expect(payload[0]).toHaveProperty('level', 6);
    expect(validateBlockKit(payload, { target: 'blocks' }).valid).toBe(false);
  });

  it('leaves a header block without a `level` untouched', () => {
    const input: SupportedBlock[] = [{ type: 'header', text: { type: 'plain_text', text: 'Heading', emoji: true } }];
    const [out] = toSlackBlocks(input);
    expect('level' in out).toBe(false);
    expect(out).toBe(input[0]);
  });

  it('passes non-header blocks through unchanged', () => {
    const input: SupportedBlock[] = [
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'hello' }
      }
    ];
    expect(toSlackBlocks(input)).toEqual(input);
  });
});

describe('url-state', () => {
  it('roundtrips an arbitrary block list through encode/decode', () => {
    const blocks: SupportedBlock[] = [
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'hello *world*' }
      },
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Heading', emoji: true }
      }
    ];

    const encoded = encodeBlocksToString(blocks);
    expect(encoded).not.toBe('');
    expect(encoded).not.toMatch(/[+/=]/);

    const decoded = decodeBlocksFromString(encoded);
    expect(decoded).toEqual(blocks);
  });

  it('encodes an empty list as the empty string', () => {
    expect(encodeBlocksToString([])).toBe('');
  });

  it.each([null, undefined, '', 'not-base64!!!', 'eyJub3QiOiJhbiBhcnJheSJ9'])(
    'decodes invalid input %p to null',
    (input) => {
      expect(decodeBlocksFromString(input)).toBeNull();
    }
  );

  it('preserves multibyte (utf-8) text through the roundtrip', () => {
    const blocks: SupportedBlock[] = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'café 北京 🚀' }
      }
    ];
    expect(decodeBlocksFromString(encodeBlocksToString(blocks))).toEqual(blocks);
  });

  it('rejects encoded input larger than 1 MiB without invoking atob', () => {
    // 1 MiB + 1 byte of arbitrary characters. We never construct a real
    // payload of this size; the guard exists so a pathological URL hash
    // returns null promptly instead of stalling the tab inside atob
    // and JSON.parse.
    const oversized = 'a'.repeat(1024 * 1024 + 1);
    expect(decodeBlocksFromString(oversized)).toBeNull();
  });
});

describe('toSlackBlocks URL sanitization', () => {
  it('scrubs javascript: from a section button url', () => {
    const input = [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'hi' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'Click' },
          url: 'javascript:alert(1)',
          action_id: 'a'
        }
      }
    ] as unknown as SupportedBlock[];
    const [out] = toSlackBlocks(input);
    const url = (out as { accessory: { url: string } }).accessory.url;
    expect(url).toBe('');
  });

  it('scrubs data:image/svg+xml from image_url', () => {
    const input = [
      { type: 'image', image_url: 'data:image/svg+xml,<svg onload=alert(1)>', alt_text: 'evil' }
    ] as unknown as SupportedBlock[];
    const [out] = toSlackBlocks(input);
    expect((out as { image_url: string }).image_url).toBe('');
  });

  // `toSlackBlocks` is the documented hardening boundary for consumers
  // that render a payload outside the builder's preview, so every URL
  // field on the video block has to be scrubbed here too — not just the
  // ones the payload sanitizer knew about when it was written.
  it('scrubs every unsafe URL field on a video block', () => {
    const input = [
      {
        type: 'video',
        alt_text: 'poc',
        title: { type: 'plain_text', text: 'PoC' },
        thumbnail_url: 'javascript:alert(1)',
        video_url: 'data:text/html,<script>top.__pwned=1</script>',
        title_url: 'javascript:alert(2)',
        provider_icon_url: 'data:image/svg+xml,<svg onload=alert(3)>'
      }
    ] as unknown as SupportedBlock[];

    const [out] = toSlackBlocks(input) as unknown as Record<string, string>[];
    expect(out.video_url).toBe('');
    expect(out.thumbnail_url).toBe('');
    expect(out.title_url).toBe('');
    expect(out.provider_icon_url).toBe('');
  });

  it('passes a legitimate https video block through unchanged', () => {
    const input = [
      {
        type: 'video',
        alt_text: 'Product demo',
        title: { type: 'plain_text', text: 'Demo', emoji: true },
        thumbnail_url: 'https://example.com/thumb.png',
        video_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        title_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      }
    ] as unknown as SupportedBlock[];

    expect(toSlackBlocks(input)).toEqual(input);
    expect(validateBlockKit(toSlackBlocks(input), { target: 'blocks' }).valid).toBe(true);
  });
});

describe('palette factories', () => {
  it('every variant factory returns a valid block payload', () => {
    for (const section of defaultPalette) {
      for (const variant of section.variants) {
        const block = variant.factory();
        // Sections like "Structure" and "Card and Carousel" intentionally
        // mix multiple block types, so we no longer assert that a
        // section maps to a single `type`. A truthy `type` is enough to
        // confirm the factory built a block-shaped payload.
        expect(typeof block.type).toBe('string');
        expect(block.type.length).toBeGreaterThan(0);
      }
    }
  });

  it('variant ids are unique across the palette', () => {
    const ids = defaultPalette.flatMap((s) => s.variants.map((v) => v.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('legacy input variants keep building input blocks', () => {
    for (const variant of legacyInputVariants) {
      expect(variant.factory().type).toBe('input');
    }
    expect(extraAlertVariant.factory().type).toBe('alert');
  });

  // Catches the failure mode where a palette default drifts out of sync with
  // the Slack Block Kit schema — users add the block, see nothing wrong in
  // the builder, and Slack rejects the payload on send. Validating every
  // factory's output through the same path the runtime uses
  // (`toSlackBlocks` → `validateBlockKit`) keeps factories honest.
  it('every default palette factory produces a payload that validates', () => {
    for (const section of defaultPalette) {
      for (const variant of section.variants) {
        const block = variant.factory();
        const result = validateBlockKit(toSlackBlocks([block]), { target: 'blocks' });
        if (!result.valid) {
          throw new Error(`Palette variant "${variant.id}" produced an invalid block:\n${result.errors.join('\n')}`);
        }
      }
    }
  });

  it('legacy input + extra alert factories also validate', () => {
    for (const variant of [...legacyInputVariants, extraAlertVariant]) {
      const block = variant.factory();
      const result = validateBlockKit(toSlackBlocks([block]), { target: 'blocks' });
      if (!result.valid) {
        throw new Error(`Legacy variant "${variant.id}" produced an invalid block:\n${result.errors.join('\n')}`);
      }
    }
  });
});

describe('package entry point', () => {
  // The send-flow primitives are public API for hosts building a bespoke
  // send UI on top of compose-only mode; a rename or dropped export is a
  // breaking change that should fail here, not in a consumer's build.
  it('exports the components and send-flow primitives', () => {
    expect(typeof BlockKitchen).toBe('function');
    expect(typeof TemplatePicker).toBe('function');
    expect(typeof SendDialog).toBe('function');
    expect(typeof useSlackSignIn).toBe('function');
    expect(typeof SlackSignInButton).toBe('function');
  });
});
