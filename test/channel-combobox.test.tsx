import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { ChannelCombobox } from '../src/components/channel-combobox';
import { Label } from '../src/lib/ui/label';
import type { ChannelOption } from '../src/types';

const CHANNELS: ChannelOption[] = [
  { id: 'C1', name: 'general' },
  { id: 'C2', name: 'random' },
  { id: 'C3', name: 'release-notes' },
  { id: 'C4', name: 'general-chat' }
];

/** The picker wired the way both dialogs wire it: labelled and controlled. */
function Harness({ onChange, initial = '' }: { onChange?: (id: string) => void; initial?: string }) {
  const [channelId, setChannelId] = useState(initial);
  return (
    <>
      <Label htmlFor="channel">Channel</Label>
      <ChannelCombobox
        id="channel"
        channels={CHANNELS}
        value={channelId}
        onChange={(id) => {
          setChannelId(id);
          onChange?.(id);
        }}
      />
    </>
  );
}

const field = () => screen.getByLabelText('Channel') as HTMLInputElement;
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);

it('opens on click and lists every channel with a space after the hash', () => {
  render(<Harness />);
  fireEvent.click(field());
  expect(optionNames()).toEqual(['# general', '# random', '# release-notes', '# general-chat']);
});

it('filters the list as you type, matching anywhere in the name', () => {
  render(<Harness />);
  fireEvent.click(field());
  fireEvent.change(field(), { target: { value: 'gener' } });
  expect(optionNames()).toEqual(['# general', '# general-chat']);

  fireEvent.change(field(), { target: { value: 'notes' } });
  expect(optionNames()).toEqual(['# release-notes']);
});

it('ignores a typed hash and its spacing when filtering', () => {
  render(<Harness />);
  fireEvent.click(field());
  fireEvent.change(field(), { target: { value: '# rand' } });
  expect(optionNames()).toEqual(['# random']);
});

it('says so when nothing matches, rather than showing an empty list', () => {
  render(<Harness />);
  fireEvent.click(field());
  fireEvent.change(field(), { target: { value: 'nope' } });
  expect(screen.queryAllByRole('option')).toEqual([]);
  expect(screen.getByText('No channels match that search.')).toBeTruthy();
});

it('commits a click and shows the pick as the field value', () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  fireEvent.click(field());
  fireEvent.click(screen.getByRole('option', { name: '# release-notes' }));

  expect(onChange).toHaveBeenCalledWith('C3');
  expect(field().value).toBe('# release-notes');
  // The list closes on a pick.
  expect(screen.queryAllByRole('option')).toEqual([]);
});

it('navigates with the arrow keys and commits the active row on Enter', () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);

  // ArrowDown on a closed field opens it, active on the first row.
  fireEvent.keyDown(field(), { key: 'ArrowDown' });
  expect(field().getAttribute('aria-expanded')).toBe('true');
  expect(field().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[0].id);

  fireEvent.keyDown(field(), { key: 'ArrowDown' });
  expect(field().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[1].id);

  fireEvent.keyDown(field(), { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('C2');
  expect(field().value).toBe('# random');
});

it('wraps around the ends of the list', () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  fireEvent.click(field());
  // Up from the first row lands on the last.
  fireEvent.keyDown(field(), { key: 'ArrowUp' });
  fireEvent.keyDown(field(), { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('C4');
});

it('opens on the current selection so Enter re-commits it rather than the first row', () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} initial="C3" />);
  expect(field().value).toBe('# release-notes');

  fireEvent.click(field());
  fireEvent.keyDown(field(), { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith('C3');
});

it('abandons the search on Escape, keeping the selection and the dialog', () => {
  const onEscape = vi.fn();
  render(
    // Stands in for the dialog's own Escape handler, which must not fire
    // while the list is open.
    <div onKeyDown={onEscape}>
      <Harness initial="C1" />
    </div>
  );

  fireEvent.click(field());
  fireEvent.change(field(), { target: { value: 'rand' } });
  fireEvent.keyDown(field(), { key: 'Escape' });

  expect(screen.queryAllByRole('option')).toEqual([]);
  // The typed search is gone and the original pick is intact.
  expect(field().value).toBe('# general');
  // Escape stopped at the combobox: an enclosing dialog would not have closed.
  expect(onEscape).not.toHaveBeenCalled();
});

it('marks the selected channel, and only that one, as selected', () => {
  render(<Harness initial="C2" />);
  fireEvent.click(field());
  const selected = screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true');
  expect(selected.map((o) => o.textContent)).toEqual(['# random']);
});
