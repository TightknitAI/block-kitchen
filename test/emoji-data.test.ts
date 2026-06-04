import {
  buildEmojiIndex,
  codepointsToGlyph,
  composeTextEmoji,
  loadEmojiIndex,
  type RawEmoji,
  unifiedToUnicode
} from '../src/lib/emoji-data';

const RAW: RawEmoji[] = [
  {
    name: 'WAVING HAND SIGN',
    unified: '1F44B',
    short_name: 'wave',
    short_names: ['wave'],
    category: 'People & Body',
    sort_order: 170,
    skin_variations: {
      '1F3FB': { unified: '1F44B-1F3FB' },
      '1F3FF': { unified: '1F44B-1F3FF' }
    }
  },
  {
    name: 'GRINNING FACE',
    unified: '1F600',
    short_name: 'grinning',
    short_names: ['grinning', 'grinning_face'],
    category: 'Smileys & Emotion',
    sort_order: 1
  },
  {
    name: 'EMOJI MODIFIER FITZPATRICK TYPE-1-2',
    unified: '1F3FB',
    short_name: 'skin-tone-2',
    short_names: ['skin-tone-2'],
    category: 'Component',
    sort_order: 5
  }
];

describe('codepointsToGlyph', () => {
  it('renders a single codepoint', () => {
    expect(codepointsToGlyph('1F44B')).toBe('👋');
  });
  it('renders multi-codepoint sequences', () => {
    expect(codepointsToGlyph('1F441-FE0F')).toBe('👁️');
  });
});

describe('unifiedToUnicode', () => {
  it('lowercases the base codepoint(s)', () => {
    expect(unifiedToUnicode('1F44B')).toBe('1f44b');
  });
});

describe('composeTextEmoji', () => {
  it('wraps a bare name in colons', () => {
    expect(composeTextEmoji('wave')).toBe(':wave:');
  });
  it('appends the skin-tone token for tones 2–6', () => {
    expect(composeTextEmoji('wave', 3)).toBe(':wave::skin-tone-3:');
  });
  it('ignores out-of-range / default skin tones', () => {
    expect(composeTextEmoji('wave', 1)).toBe(':wave:');
    expect(composeTextEmoji('wave', 7)).toBe(':wave:');
  });
});

describe('buildEmojiIndex', () => {
  const index = buildEmojiIndex(RAW);

  it('drops the Component category', () => {
    expect(index.byName.has('skin-tone-2')).toBe(false);
    expect(index.all.some((e) => e.category === 'Component')).toBe(false);
  });

  it('indexes by every short_name and by base codepoint', () => {
    expect(index.byName.get('grinning')?.name).toBe('grinning');
    expect(index.byName.get('grinning_face')?.name).toBe('grinning');
    expect(index.byUnified.get('1F44B')?.name).toBe('wave');
  });

  it('maps skin variations to Slack skin_tone integers (2–6)', () => {
    const wave = index.byName.get('wave');
    expect(wave?.skinUnified[2]).toBe('1F44B-1F3FB');
    expect(wave?.skinUnified[6]).toBe('1F44B-1F3FF');
    expect(wave?.skinUnified[1]).toBeUndefined();
  });

  it('orders entries by sort_order and groups by Slack category order', () => {
    // grinning (sort 1) precedes wave (sort 170)
    expect(index.all.map((e) => e.name)).toEqual(['grinning', 'wave']);
    expect(index.byCategory.map((g) => g.category)).toEqual(['Smileys & Emotion', 'People & Body']);
  });
});

describe('loadEmojiIndex (real emoji-datasource)', () => {
  it('loads the bundled dataset and resolves canonical Slack codenames', async () => {
    const index = await loadEmojiIndex();
    expect(index.all.length).toBeGreaterThan(1000);
    // `wave` is an iamcal short_name and resolves to the waving-hand codepoint.
    expect(index.byName.get('wave')?.unified).toBe('1F44B');
    // Memoized: a second call returns the same reference.
    expect(await loadEmojiIndex()).toBe(index);
  });
});
