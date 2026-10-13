import { fireEvent, render, screen, within } from '@testing-library/react';
import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../src/components/editors/block-editor';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import type { DataTableActionCell, DataTableBlock, DataTableCell, TableCell } from '../src/types';

const text = (value: string): DataTableCell => ({ type: 'raw_text', text: value });

const RICH: TableCell = {
  type: 'rich_text',
  elements: [{ type: 'rich_text_section', elements: [{ type: 'text', text: 'Blue', style: { bold: true } }] }]
};

const ACTION: DataTableActionCell = {
  type: 'action_cell',
  element: { type: 'button', text: { type: 'plain_text', text: 'Mark done' }, action_id: 'mark_done', value: 'task_1' },
  fallback: { type: 'raw_text', text: 'Open' }
};

const table = (fields: Partial<DataTableBlock> = {}): DataTableBlock => ({
  type: 'data_table',
  caption: 'Departments',
  rows: [
    [text('Name'), text('Department'), text('Badge')],
    [text('Data Refinement'), text('MDR'), text('Blue')],
    [text('Art Sourcing'), text('O&D'), text('Green')]
  ],
  ...fields
});

function renderEditor(block: DataTableBlock) {
  const onChange = vi.fn();
  render(<BlockEditor block={block} onChange={onChange} />);
  return onChange;
}

function lastChange(onChange: ReturnType<typeof vi.fn>): DataTableBlock {
  return onChange.mock.calls.at(-1)?.[0];
}

describe('DataTableEditor fields', () => {
  it('edits the caption', () => {
    const onChange = renderEditor(table());

    fireEvent.change(screen.getByLabelText('Caption'), { target: { value: 'Open deals' } });

    expect(lastChange(onChange).caption).toBe('Open deals');
  });

  it('sets rows per page within 1-100', () => {
    const onChange = renderEditor(table());
    const input = screen.getByLabelText('Rows per page');

    fireEvent.change(input, { target: { value: '10' } });
    expect(lastChange(onChange).page_size).toBe(10);

    fireEvent.change(input, { target: { value: '500' } });
    expect(lastChange(onChange).page_size).toBe(100);

    fireEvent.change(input, { target: { value: '0' } });
    expect(lastChange(onChange).page_size).toBe(1);
  });

  it('drops rows per page when cleared, so Slack falls back to 5', () => {
    const onChange = renderEditor(table({ page_size: 10 }));

    fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '' } });

    expect(lastChange(onChange)).not.toHaveProperty('page_size');
  });

  it('lists row header columns by their header text', () => {
    renderEditor(table());

    const options = within(screen.getByLabelText('Row header column')).getAllByRole('option');

    expect(options.map((o) => o.textContent)).toEqual(['Column 1: Name', 'Column 2: Department', 'Column 3: Badge']);
  });

  it('sets the row header column, and drops it when the first (default) column is picked', () => {
    const onChange = renderEditor(table({ row_header_column_index: 2 }));
    const select = screen.getByLabelText('Row header column');

    fireEvent.change(select, { target: { value: '1' } });
    expect(lastChange(onChange).row_header_column_index).toBe(1);

    fireEvent.change(select, { target: { value: '0' } });
    expect(lastChange(onChange)).not.toHaveProperty('row_header_column_index');
  });
});

describe('DataTableEditor columns and rows', () => {
  it('keeps the row header on the same column when an earlier column is removed', () => {
    const onChange = renderEditor(table({ row_header_column_index: 2 }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove column 1' }));

    expect(lastChange(onChange).row_header_column_index).toBe(1);
    expect(lastChange(onChange).rows[0]).toEqual([text('Department'), text('Badge')]);
  });

  it('resets the row header to the default when its column is removed', () => {
    const onChange = renderEditor(table({ row_header_column_index: 1 }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove column 2' }));

    expect(lastChange(onChange)).not.toHaveProperty('row_header_column_index');
  });

  it('adds a blank row and a blank column the same length as the others', () => {
    const onChange = renderEditor(table());

    fireEvent.click(screen.getByRole('button', { name: /add row/i }));
    expect(lastChange(onChange).rows.at(-1)).toEqual([text(''), text(''), text('')]);

    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    expect(lastChange(onChange).rows.map((row) => row.length)).toEqual([4, 4, 4]);
  });

  it('never removes the header row, and keeps at least one data row', () => {
    renderEditor(table({ rows: [[text('Name')], [text('MDR')]] }));

    expect(screen.queryByRole('button', { name: 'Remove row 1' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Remove row 2' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows up to 200 data rows under the header', () => {
    const rows = (count: number) => Array.from({ length: count }, (_, i) => [text(`Row ${i}`)]);

    const { unmount } = render(<BlockEditor block={table({ rows: rows(200) })} onChange={vi.fn()} />);
    expect((screen.getByRole('button', { name: /add row/i }) as HTMLButtonElement).disabled).toBe(false);
    unmount();

    render(<BlockEditor block={table({ rows: rows(201) })} onChange={vi.fn()} />);
    expect((screen.getByRole('button', { name: /add row/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('allows up to 20 columns', () => {
    const wide = Array.from({ length: 20 }, (_, i) => text(`C${i}`));

    renderEditor(table({ rows: [wide, wide] }));

    expect((screen.getByRole('button', { name: /add column/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('DataTableEditor cell types', () => {
  it.each([
    ['42', { type: 'raw_number', value: 42 }],
    ['1,200', { type: 'raw_number', value: 1200, text: '1,200' }],
    ['MDR', { type: 'raw_number', value: 0, text: 'MDR' }]
  ])('turns the text cell %j into a number cell', (value, expected) => {
    const onChange = renderEditor(table({ rows: [[text('Name')], [text(value)]] }));

    fireEvent.click(screen.getByRole('button', { name: 'Row 2, column 1 as number' }));

    expect(lastChange(onChange).rows[1][0]).toEqual(expected);
  });

  it.each([
    [{ type: 'raw_number', value: 7 } as const, '7'],
    [{ type: 'raw_number', value: 1200000, text: '$1.2M' } as const, '$1.2M']
  ])('turns the number cell %j back into text showing %j', (cell, expected) => {
    const onChange = renderEditor(table({ rows: [[text('Value')], [cell]] }));
    const toggle = screen.getByRole('button', { name: 'Row 2, column 1 as number' });

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);

    expect(lastChange(onChange).rows[1][0]).toEqual(text(expected));
  });

  it("edits a number cell's value and display text, dropping empty display text", () => {
    const onChange = renderEditor(table({ rows: [[text('Value')], [{ type: 'raw_number', value: 1, text: 'one' }]] }));

    fireEvent.change(screen.getByLabelText('Row 2, column 1 value'), { target: { value: '3.5' } });
    expect(lastChange(onChange).rows[1][0]).toEqual({ type: 'raw_number', value: 3.5, text: 'one' });

    fireEvent.change(screen.getByLabelText('Row 2, column 1 display text'), { target: { value: '' } });
    expect(lastChange(onChange).rows[1][0]).toEqual({ type: 'raw_number', value: 1 });
  });

  it('offers no number toggle on header text cells', () => {
    renderEditor(table());

    expect(screen.queryByRole('button', { name: 'Row 1, column 1 as number' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Row 2, column 1 as number' })).toBeTruthy();
  });

  it('leaves rich text and button cells untouched when another cell is edited', () => {
    const onChange = renderEditor(
      table({
        rows: [
          [text('Name'), text('Badge'), text('Action')],
          [text('MDR'), RICH, ACTION]
        ]
      })
    );

    fireEvent.change(screen.getByLabelText('Row 2, column 1'), { target: { value: 'Macrodata' } });

    expect(lastChange(onChange).rows[1]).toEqual([text('Macrodata'), RICH, ACTION]);
  });

  it('shows a button cell read-only, by its label', () => {
    renderEditor(table({ rows: [[text('Action')], [ACTION]] }));

    expect(screen.getByText('Mark done')).toBeTruthy();
    expect(screen.queryByLabelText('Row 2, column 1')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Row 2, column 1 as number' })).toBeNull();
  });

  it('replaces a rich text cell with plain text once it is typed over', () => {
    const onChange = renderEditor(table({ rows: [[text('Badge')], [RICH]] }));

    expect(screen.queryByRole('button', { name: 'Row 2, column 1 as number' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Row 2, column 1'), { target: { value: 'Blue' } });

    expect(lastChange(onChange).rows[1][0]).toEqual(text('Blue'));
  });
});

describe('data_table payloads validate', () => {
  it.each(['message', 'home'] as const)('accepts number cells, page size and a row header column on %s', (surface) => {
    const block = table({
      page_size: 2,
      row_header_column_index: 1,
      rows: [
        [text('Name'), text('Members')],
        [text('MDR'), { type: 'raw_number', value: 4 }],
        [text('O&D'), { type: 'raw_number', value: 1200, text: '1,200' }]
      ]
    });

    expect(validateBlockKit(toSlackBlocks([block]), { target: 'blocks', surface }).errors).toEqual([]);
  });
});
