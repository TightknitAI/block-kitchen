import { Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import type { TableCell, TableRawTextCell } from '../../types';
import { EditorField } from './field';

/**
 * A column added or removed through {@link CellGrid}, so the caller can
 * keep per-column settings aligned with the cells.
 */
export type ColumnEdit = { kind: 'add' } | { kind: 'remove'; index: number };

/**
 * Where a cell sits in a {@link CellGrid}, plus an accessible name for its
 * inputs (e.g. "Row 2, column 1").
 */
export interface CellPosition {
  row: number;
  col: number;
  label: string;
}

const REMOVE_BUTTON_CLASS =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Rows × columns cell editor shared by the `table` and `data_table`
 * editors: per-row and per-column remove buttons, "Add row" / "Add
 * column", and a caller-rendered control for each cell and column. Every
 * row stays the same length.
 * @param props - grid props
 * @param props.label - field label above the grid
 * @param props.help - helper text under the grid
 * @param props.rows - the cell rows
 * @param props.minRows - rows that can't be removed below
 * @param props.maxRows - "Add row" is disabled at this many rows
 * @param props.maxColumns - "Add column" is disabled at this many columns
 * @param props.lockFirstRow - when true, the first row (a header) has no remove button
 * @param props.blankCell - builds the cell used to fill new rows and columns
 * @param props.renderCell - renders one cell's control; `update` replaces that cell
 * @param props.renderColumnControl - optional per-column control shown beside its remove button
 * @param props.onChange - called with the next rows, and the column edit when columns changed
 * @returns the rendered grid and its add buttons
 */
export function CellGrid<TCell>({
  label,
  help,
  rows,
  minRows,
  maxRows,
  maxColumns,
  lockFirstRow = false,
  blankCell,
  renderCell,
  renderColumnControl,
  onChange
}: {
  label: string;
  help: string;
  rows: TCell[][];
  minRows: number;
  maxRows: number;
  maxColumns: number;
  lockFirstRow?: boolean;
  blankCell: () => TCell;
  renderCell: (cell: TCell, position: CellPosition, update: (next: TCell) => void) => ReactNode;
  renderColumnControl?: (col: number) => ReactNode;
  onChange: (rows: TCell[][], columnEdit?: ColumnEdit) => void;
}) {
  const columnCount = rows[0]?.length ?? 0;

  const setCell = (rowIdx: number, colIdx: number, next: TCell) => {
    onChange(rows.map((row, r) => (r === rowIdx ? row.map((cell, c) => (c === colIdx ? next : cell)) : row)));
  };

  const addRow = () => {
    onChange([...rows, Array.from({ length: columnCount || 1 }, blankCell)]);
  };

  const removeRow = (rowIdx: number) => {
    if (rows.length <= minRows) {
      return;
    }
    onChange(rows.filter((_, r) => r !== rowIdx));
  };

  const addColumn = () => {
    onChange(
      rows.map((row) => [...row, blankCell()]),
      { kind: 'add' }
    );
  };

  const removeColumn = (colIdx: number) => {
    if (columnCount <= 1) {
      return;
    }
    onChange(
      rows.map((row) => row.filter((_, c) => c !== colIdx)),
      { kind: 'remove', index: colIdx }
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <EditorField label={label} help={help}>
        <div className="flex flex-col gap-2 overflow-x-auto">
          {/* Column controls */}
          <div className="flex items-center gap-1">
            <span className="w-6 shrink-0" aria-hidden="true" />
            {Array.from({ length: columnCount }, (_, c) => (
              <div key={c} className="flex min-w-[120px] flex-1 items-center gap-1">
                {renderColumnControl ? (
                  renderColumnControl(c)
                ) : (
                  <span className="flex-1 truncate px-1.5 text-[11px] text-muted-foreground">Column {c + 1}</span>
                )}
                <button
                  type="button"
                  aria-label={`Remove column ${c + 1}`}
                  onClick={() => removeColumn(c)}
                  disabled={columnCount <= 1}
                  className={REMOVE_BUTTON_CLASS}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Cell grid */}
          {rows.map((row, r) => (
            <div key={r} className="flex items-center gap-1">
              {lockFirstRow && r === 0 ? (
                <span className="w-6 shrink-0" aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  aria-label={`Remove row ${r + 1}`}
                  onClick={() => removeRow(r)}
                  disabled={rows.length <= minRows}
                  className={REMOVE_BUTTON_CLASS}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              {row.map((cell, c) => (
                <div key={c} className="flex min-w-[120px] flex-1 flex-col gap-0.5">
                  {renderCell(cell, { row: r, col: c, label: `Row ${r + 1}, column ${c + 1}` }, (next) =>
                    setCell(r, c, next)
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </EditorField>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={addRow} disabled={rows.length >= maxRows}>
          <Plus className="h-3.5 w-3.5" /> Add row
        </Button>
        <Button type="button" size="sm" onClick={addColumn} disabled={columnCount >= maxColumns}>
          <Plus className="h-3.5 w-3.5" /> Add column
        </Button>
      </div>
    </div>
  );
}

/**
 * Text input for a raw_text or rich_text cell. A rich-text cell shows a
 * `[rich_text]` placeholder value and is left untouched until the user
 * types, which replaces it with a raw_text cell.
 * @param props - input props
 * @param props.cell - the cell being edited
 * @param props.label - accessible name for the input
 * @param props.placeholder - greyed-out hint for an empty cell
 * @param props.leading - optional control rendered before the input
 * @param props.richTextNote - note shown under a rich-text cell
 * @param props.onChange - called with the replacement raw_text cell
 * @returns the rendered cell input
 */
export function CellTextInput({
  cell,
  label,
  placeholder,
  leading,
  richTextNote = 'Was rich-text; editing replaces with plain text.',
  onChange
}: {
  cell: TableCell;
  label: string;
  placeholder: string;
  leading?: ReactNode;
  richTextNote?: string;
  onChange: (next: TableRawTextCell) => void;
}) {
  const input = (
    <Input
      aria-label={label}
      value={cell.type === 'raw_text' ? cell.text : '[rich_text]'}
      placeholder={placeholder}
      onChange={(e) => onChange({ type: 'raw_text', text: e.target.value })}
      className="h-8 text-xs"
    />
  );
  return (
    <>
      {leading ? (
        <div className="flex items-center gap-1">
          {leading}
          {input}
        </div>
      ) : (
        input
      )}
      {cell.type === 'rich_text' ? (
        <span className={cn('text-[10px] text-muted-foreground', leading && 'pl-7')}>{richTextNote}</span>
      ) : null}
    </>
  );
}
