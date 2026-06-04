import { render } from '@testing-library/react';
import { CustomEmojiProvider, useCustomEmojis } from '../src/state/custom-emoji-context';
import type { CustomEmoji } from '../src/types';

function Probe() {
  const { customEmojis, byName } = useCustomEmojis();
  return (
    <div
      data-count={String(customEmojis.length)}
      data-has-parrot={String(byName.has('partyparrot'))}
      data-parrot-url={byName.get('partyparrot')?.url ?? 'none'}
    />
  );
}

const read = (container: HTMLElement) => container.querySelector('div') as HTMLElement;

describe('CustomEmojiProvider / useCustomEmojis', () => {
  it('exposes an empty value when no provider is mounted', () => {
    const { container } = render(<Probe />);
    expect(read(container).getAttribute('data-count')).toBe('0');
    expect(read(container).getAttribute('data-has-parrot')).toBe('false');
  });

  it('exposes an empty value when customEmojis is omitted', () => {
    const { container } = render(
      <CustomEmojiProvider>
        <Probe />
      </CustomEmojiProvider>
    );
    expect(read(container).getAttribute('data-count')).toBe('0');
  });

  it('builds a byName lookup from the provided custom emoji', () => {
    const emojis: CustomEmoji[] = [
      { name: 'partyparrot', url: 'https://emoji.test/p.gif', alias: null },
      { name: 'shipit', url: null, alias: 'rocket' }
    ];
    const { container } = render(
      <CustomEmojiProvider customEmojis={emojis}>
        <Probe />
      </CustomEmojiProvider>
    );
    expect(read(container).getAttribute('data-count')).toBe('2');
    expect(read(container).getAttribute('data-has-parrot')).toBe('true');
    expect(read(container).getAttribute('data-parrot-url')).toBe('https://emoji.test/p.gif');
  });
});
