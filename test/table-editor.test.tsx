import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../src/components/editors/block-editor';
import type { TableBlock, TableCell } from '../src/types';

const text = (value: string): TableCell => ({ type: 'raw_text', text: value });

const table = (fields: Partial<TableBlock> = {}): TableBlock => ({
  type: 'table',
  rows: [
    [text('A'), text('B')],
    [text('1'), text('2')]
  ],
  ...fields
});

function renderEditor(block: TableBlock) {
  const onChange = vi.fn();
  render(<BlockEditor block={block} onChange={onChange} />);
  return onChange;
}

function lastChange(onChange: ReturnType<typeof vi.fn>): TableBlock {
  return onChange.mock.calls.at(-1)?.[0];
}

describe('TableEditor', () => {
  it('adds a column with a blank cell per row and an unset column setting', () => {
    const onChange = renderEditor(table({ column_settings: [{ align: 'right' }, null] }));

    fireEvent.click(screen.getByRole('button', { name: /add column/i }));

    expect(lastChange(onChange).rows).toEqual([
      [text('A'), text('B'), text('')],
      [text('1'), text('2'), text('')]
    ]);
    expect(lastChange(onChange).column_settings).toEqual([{ align: 'right' }, null, null]);
  });

  it("removes a column's cells and its setting", () => {
    const onChange = renderEditor(table({ column_settings: [{ align: 'right' }, { align: 'center' }] }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove column 1' }));

    expect(lastChange(onChange).rows).toEqual([[text('B')], [text('2')]]);
    expect(lastChange(onChange).column_settings).toEqual([{ align: 'center' }]);
  });

  it('sets a column alignment', () => {
    const onChange = renderEditor(table());

    fireEvent.change(screen.getByLabelText('Column 2 alignment'), { target: { value: 'center' } });

    expect(lastChange(onChange).column_settings).toEqual([null, { align: 'center' }]);
  });

  it('removes any row, including the first, down to one', () => {
    const onChange = renderEditor(table());

    fireEvent.click(screen.getByRole('button', { name: 'Remove row 1' }));
    expect(lastChange(onChange).rows).toEqual([[text('1'), text('2')]]);
  });

  it('caps the table at 100 rows', () => {
    const rows = Array.from({ length: 100 }, (_, i) => [text(String(i))]);

    renderEditor(table({ rows }));

    expect((screen.getByRole('button', { name: /add row/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
