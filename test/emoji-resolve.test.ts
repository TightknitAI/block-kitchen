import { buildEmojiIndex, type RawEmoji } from '../src/lib/emoji-data';
import { makeEmojiImportResolver } from '../src/lib/emoji-resolve';
import type { CustomEmoji } from '../src/types';

const INDEX = buildEmojiIndex([
  {
    name: 'WAVING HAND SIGN',
    unified: '1F44B',
    short_name: 'wave',
    short_names: ['wave'],
    category: 'People & Body',
    sort_order: 170,
    skin_variations: { '1F3FC': { unified: '1F44B-1F3FC' } }
  } as RawEmoji
]);

const custom = (entries: CustomEmoji[]) => new Map(entries.map((e) => [e.name, e] as const));

describe('makeEmojiImportResolver', () => {
  it('resolves a custom emoji with a url to its image src', () => {
    const resolve = makeEmojiImportResolver(custom([{ name: 'parrot', url: 'https://x/p.gif', alias: null }]), INDEX);
    expect(resolve({ type: 'emoji', name: 'parrot' })).toEqual({
      name: 'parrot',
      src: 'https://x/p.gif',
      unicode: null,
      skinTone: null
    });
  });

  it('resolves a custom alias to the target glyph codepoints', () => {
    const resolve = makeEmojiImportResolver(custom([{ name: 'hi', url: null, alias: 'wave' }]), INDEX);
    expect(resolve({ type: 'emoji', name: 'hi' })).toEqual({
      name: 'hi',
      src: null,
      unicode: '1f44b',
      skinTone: null
    });
  });

  it('resolves a standard emoji unicode from the dataset', () => {
    const resolve = makeEmojiImportResolver(custom([]), INDEX);
    expect(resolve({ type: 'emoji', name: 'wave' })).toEqual({
      name: 'wave',
      src: null,
      unicode: '1f44b',
      skinTone: null
    });
  });

  it('uses the toned codepoints when a supported skin_tone is present', () => {
    const resolve = makeEmojiImportResolver(custom([]), INDEX);
    expect(resolve({ type: 'emoji', name: 'wave', skin_tone: 3 })).toEqual({
      name: 'wave',
      src: null,
      unicode: '1f44b-1f3fc',
      skinTone: 3
    });
  });

  it('keeps the payload unicode and degrades when the dataset is absent', () => {
    const resolve = makeEmojiImportResolver(custom([]), null);
    expect(resolve({ type: 'emoji', name: 'mystery', unicode: '1f600' })).toEqual({
      name: 'mystery',
      src: null,
      unicode: '1f600',
      skinTone: null
    });
  });
});
