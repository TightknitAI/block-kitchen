import { render, screen } from '@testing-library/react';
import { SlackBlockPreview } from '../src/components/preview/slack-block-preview';
import type { PreviewHooks, SupportedBlock } from '../src/types';

const mention = {
  type: 'rich_text',
  elements: [
    {
      type: 'rich_text_section',
      elements: [
        { type: 'text', text: 'Thanks ' },
        { type: 'user', user_id: 'U0ADA' }
      ]
    }
  ]
} as SupportedBlock;

/**
 * The hooks a host passes before it has resolved anyone, then after.
 * @param names - the names the host knows so far
 * @returns preview hooks labeling mentions from `names`
 */
const hooksKnowing = (names: Record<string, string>): PreviewHooks => ({
  user: ({ id }: { id: string }) => <span>@{names[id] ?? id}</span>
});

describe('SlackBlockPreview hooks', () => {
  it('renders with hooks that change after the first paint, as a host resolves names', () => {
    const { rerender } = render(<SlackBlockPreview block={mention} hooks={hooksKnowing({})} />);
    expect(screen.getByText('@U0ADA')).toBeTruthy();

    rerender(<SlackBlockPreview block={mention} hooks={hooksKnowing({ U0ADA: 'Ada Lovelace' })} />);

    expect(screen.getByText('@Ada Lovelace')).toBeTruthy();
    expect(screen.queryByText('@U0ADA')).toBeNull();
  });

  it('falls back to the renderer default when the host drops its hooks', () => {
    const { rerender, container } = render(
      <SlackBlockPreview block={mention} hooks={hooksKnowing({ U0ADA: 'Ada Lovelace' })} />
    );
    expect(screen.getByText('@Ada Lovelace')).toBeTruthy();

    rerender(<SlackBlockPreview block={mention} />);

    expect(screen.queryByText('@Ada Lovelace')).toBeNull();
    expect(container.textContent).toContain('Thanks');
  });
});
