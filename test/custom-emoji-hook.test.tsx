import { render } from '@testing-library/react';
import { makeEmojiHook } from '../src/lib/custom-emoji-hook';
import type { CustomEmoji } from '../src/types';

const byName = (entries: CustomEmoji[]) => new Map(entries.map((e) => [e.name, e] as const));

describe('makeEmojiHook', () => {
  it('renders the workspace image for a custom emoji with a url', () => {
    const hook = makeEmojiHook(byName([{ name: 'partyparrot', url: 'https://emoji.test/p.gif', alias: null }]));
    const parse = vi.fn(() => 'PARSED');
    const { container } = render(<div>{hook({ name: 'partyparrot' }, parse)}</div>);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://emoji.test/p.gif');
    expect(img?.getAttribute('alt')).toBe(':partyparrot:');
    expect(parse).not.toHaveBeenCalled();
  });

  it('defers to the parser with the alias target for an alias entry (no url)', () => {
    const hook = makeEmojiHook(byName([{ name: 'shipit', url: null, alias: 'rocket' }]));
    const parse = vi.fn(() => 'GLYPH');
    render(<div>{hook({ name: 'shipit', unicode: '1f680', skin_tone: 3 }, parse)}</div>);
    expect(parse).toHaveBeenCalledWith({ name: 'rocket', unicode: '1f680', skin_tone: 3 });
  });

  it('prefers the url over the alias when both are present', () => {
    const hook = makeEmojiHook(byName([{ name: 'both', url: 'https://emoji.test/b.png', alias: 'rocket' }]));
    const parse = vi.fn(() => 'GLYPH');
    const { container } = render(<div>{hook({ name: 'both' }, parse)}</div>);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://emoji.test/b.png');
    expect(parse).not.toHaveBeenCalled();
  });

  it('passes standard / unknown emoji straight through to the parser', () => {
    const hook = makeEmojiHook(byName([{ name: 'partyparrot', url: 'https://emoji.test/p.gif', alias: null }]));
    const parse = vi.fn(() => 'GLYPH');
    const data = { name: 'smile', unicode: '1f604', skin_tone: undefined };
    render(<div>{hook(data, parse)}</div>);
    expect(parse).toHaveBeenCalledWith(data);
  });
});
