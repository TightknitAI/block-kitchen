import { beforeEach } from 'vitest';
import { pushEmojiRecent, readEmojiRecents, readEmojiSkinTone, writeEmojiSkinTone } from '../src/lib/emoji-recents';

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe('emoji recents', () => {
  it('returns an empty list initially', () => {
    expect(readEmojiRecents()).toEqual([]);
  });

  it('records most-recent-first and de-duplicates', () => {
    pushEmojiRecent('wave');
    pushEmojiRecent('smile');
    const after = pushEmojiRecent('wave');
    expect(after).toEqual(['wave', 'smile']);
    expect(readEmojiRecents()).toEqual(['wave', 'smile']);
  });

  it('caps the list length', () => {
    let last: string[] = [];
    for (let i = 0; i < 40; i++) {
      last = pushEmojiRecent(`e${i}`);
    }
    expect(last.length).toBe(24);
    expect(last[0]).toBe('e39');
  });
});

describe('emoji skin tone', () => {
  it('defaults to null', () => {
    expect(readEmojiSkinTone()).toBeNull();
  });

  it('persists tones 2–6 and clears on null / out of range', () => {
    writeEmojiSkinTone(4);
    expect(readEmojiSkinTone()).toBe(4);
    writeEmojiSkinTone(null);
    expect(readEmojiSkinTone()).toBeNull();
    writeEmojiSkinTone(9);
    expect(readEmojiSkinTone()).toBeNull();
  });
});
