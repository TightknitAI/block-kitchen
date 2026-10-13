import { Hash, MousePointerClick } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Input } from '../../lib/ui/input';
import type { DataTableBlock, DataTableCell, DataTableRawNumberCell, TableRawTextCell } from '../../types';
import { CellGrid, type CellPosition, CellTextInput, type ColumnEdit } from './cell-grid';
import { EditorField } from './field';
import { NumberInput } from './number-input';
import type { BlockEditorProps } from './types';

/** Header row plus Slack's 200 data rows. */
const MAX_ROWS = 201;
/** Header row plus at least one data row. */
const MIN_ROWS = 2;
const MAX_COLUMNS = 20;
const MAX_PAGE_SIZE = 100;

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Returns the block with an optional field set, or removed when `value`
 * is undefined so the payload never carries an empty key.
 * @param block - the data table block
 * @param key - the optional field to set
 * @param value - the new value, or undefined to drop the field
 * @returns the updated block
 */
function withOptional(
  block: DataTableBlock,
  key: 'page_size' | 'row_header_column_index',
  value: number | undefined
): DataTableBlock {
  const next: DataTableBlock = { ...block };
  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

/**
 * Where the row header column lands after a column is removed: shifted
 * left when an earlier column goes, back to Slack's default (the first
 * column) when its own column goes.
 * @param index - the current row header column index, if set
 * @param edit - the column edit just applied to the cells
 * @returns the next row header column index, if any
 */
function realignRowHeader(index: number | undefined, edit: ColumnEdit): number | undefined {
  if (index === undefined || edit.kind === 'add' || edit.index > index) {
    return index;
  }
  return edit.index === index ? undefined : index - 1;
}

/**
 * Visible text of a cell, for column labels and button summaries. Rich
 * text has no plain form here, so it reads as empty.
 * @param cell - the cell
 * @returns the cell's display text
 */
function cellText(cell: DataTableCell | undefined): string {
  switch (cell?.type) {
    case 'raw_text':
      return cell.text;
    case 'raw_number':
      return cell.text ?? String(cell.value);
    case 'action_cell':
      return cell.element.text.text;
    default:
      return '';
  }
}

/**
 * Converts a text cell to a number cell. Commas are ignored when parsing
 * (`"1,200"` is 1200); text that isn't a number becomes the display text
 * over a 0 value, so nothing the user typed is lost.
 * @param cell - the raw_text cell
 * @returns the equivalent raw_number cell
 */
function toNumberCell(cell: TableRawTextCell): DataTableRawNumberCell {
  const text = cell.text.trim();
  const parsed = text === '' ? Number.NaN : Number(text.replace(/,/g, ''));
  if (Number.isFinite(parsed)) {
    return String(parsed) === text
      ? { type: 'raw_number', value: parsed }
      : { type: 'raw_number', value: parsed, text };
  }
  return text ? { type: 'raw_number', value: 0, text } : { type: 'raw_number', value: 0 };
}

/**
 * Converts a number cell back to a text cell showing what it displayed.
 * @param cell - the raw_number cell
 * @returns the equivalent raw_text cell
 */
function toTextCell(cell: DataTableRawNumberCell): TableRawTextCell {
  return { type: 'raw_text', text: cell.text ?? String(cell.value) };
}

/**
 * Editor form for `data_table` blocks: caption, rows per page, the row
 * header column, and the cell grid. The first row is the header and can't
 * be removed, so a data row (which may hold rich text) never becomes the
 * header. Data cells toggle between text and number.
 *
 * Rich-text cells are preserved until the user types over them, like the
 * table editor. Button (`action_cell`) cells are shown read-only and
 * preserved as-is; edit them via the View JSON drawer.
 * @param props - editor props
 * @param props.block - the data table block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered data table editor form
 */
export function DataTableEditor({ block, onChange }: BlockEditorProps<DataTableBlock>) {
  const rows = block.rows ?? [];
  const header = rows[0] ?? [];
  const rowHeader = block.row_header_column_index ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <EditorField label="Caption" help="Required. Names the table for screen readers." htmlFor="data-table-caption">
        <Input
          id="data-table-caption"
          value={block.caption}
          placeholder="e.g. Open deals by stage"
          onChange={(e) => onChange({ ...block, caption: e.target.value })}
        />
      </EditorField>

      <div className="grid grid-cols-2 gap-2">
        <EditorField
          label="Rows per page"
          help="Optional, 1-100. Slack shows 5 when empty."
          htmlFor="data-table-page-size"
        >
          <Input
            id="data-table-page-size"
            type="number"
            min={1}
            max={MAX_PAGE_SIZE}
            value={block.page_size ?? ''}
            placeholder="5"
            onChange={(e) => {
              const n = Math.trunc(Number(e.target.value));
              const next =
                e.target.value === '' || Number.isNaN(n) ? undefined : Math.min(MAX_PAGE_SIZE, Math.max(1, n));
              onChange(withOptional(block, 'page_size', next));
            }}
          />
        </EditorField>
        <EditorField
          label="Row header column"
          help="The column that identifies each row for screen readers."
          htmlFor="data-table-row-header"
        >
          <select
            id="data-table-row-header"
            value={rowHeader}
            disabled={header.length === 0}
            // The first column is Slack's default, so picking it drops the field.
            onChange={(e) => {
              const index = Number(e.target.value);
              onChange(withOptional(block, 'row_header_column_index', index === 0 ? undefined : index));
            }}
            className={SELECT_CLASS}
          >
            {header.map((cell, c) => {
              const text = cellText(cell);
              return (
                <option key={c} value={c}>
                  {text ? `Column ${c + 1}: ${text}` : `Column ${c + 1}`}
                </option>
              );
            })}
            {rowHeader >= header.length ? <option value={rowHeader}>Column {rowHeader + 1} (missing)</option> : null}
          </select>
        </EditorField>
      </div>

      <CellGrid<DataTableCell>
        label="Cells"
        help="The first row is the header. Up to 200 more rows and 20 columns. Use # to make a cell a number; a column of only numbers sorts numerically."
        rows={rows}
        minRows={MIN_ROWS}
        maxRows={MAX_ROWS}
        maxColumns={MAX_COLUMNS}
        lockFirstRow
        blankCell={() => ({ type: 'raw_text', text: '' })}
        onChange={(nextRows, edit) => {
          const next = { ...block, rows: nextRows };
          onChange(
            edit
              ? withOptional(next, 'row_header_column_index', realignRowHeader(block.row_header_column_index, edit))
              : next
          );
        }}
        renderCell={(cell, position, update) => (
          <DataTableCellField cell={cell} position={position} onChange={update} />
        )}
      />
    </div>
  );
}

/**
 * Editor for one data table cell, by type: a text input, a number input
 * plus optional display text, or a read-only summary of a button cell.
 * Text cells outside the header, and every number cell, carry a # toggle
 * between the two.
 * @param props - field props
 * @param props.cell - the cell being edited
 * @param props.position - the cell's row, column, and accessible name
 * @param props.onChange - called with the replacement cell
 * @returns the rendered cell editor
 */
function DataTableCellField({
  cell,
  position,
  onChange
}: {
  cell: DataTableCell;
  position: CellPosition;
  onChange: (next: DataTableCell) => void;
}) {
  const { row, col, label } = position;

  if (cell.type === 'action_cell') {
    return (
      <>
        <div className="flex items-center gap-1">
          <ToggleSpacer />
          <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-dashed px-2 text-xs text-muted-foreground">
            <MousePointerClick className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{cellText(cell) || 'Button'}</span>
          </div>
        </div>
        <span className="pl-7 text-[10px] text-muted-foreground">Button cell. Edit it via View JSON.</span>
      </>
    );
  }

  if (cell.type === 'raw_number') {
    return (
      <>
        <div className="flex items-center gap-1">
          <NumberToggle label={label} pressed onClick={() => onChange(toTextCell(cell))} />
          <NumberInput
            value={cell.value}
            ariaLabel={`${label} value`}
            onCommit={(value) => onChange({ ...cell, value })}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <ToggleSpacer />
          <Input
            aria-label={`${label} display text`}
            value={cell.text ?? ''}
            placeholder="Display as (optional)"
            onChange={(e) => {
              const { text: _omit, ...rest } = cell;
              onChange(e.target.value ? { ...rest, text: e.target.value } : rest);
            }}
            className="h-7 text-[11px]"
          />
        </div>
      </>
    );
  }

  const isHeader = row === 0;
  return (
    <CellTextInput
      cell={cell}
      label={label}
      placeholder={isHeader ? `Header ${col + 1}` : 'Cell text'}
      richTextNote={isHeader ? "Header cells can't be rich text. Type to replace it." : undefined}
      leading={
        !isHeader && cell.type === 'raw_text' ? (
          <NumberToggle label={label} pressed={false} onClick={() => onChange(toNumberCell(cell))} />
        ) : (
          <ToggleSpacer />
        )
      }
      onChange={onChange}
    />
  );
}

/** Holds the toggle's width in cells without one, so inputs line up. */
function ToggleSpacer() {
  return <span className="h-6 w-6 shrink-0" aria-hidden="true" />;
}

/**
 * Toggle between a text cell and a number cell.
 * @param props - toggle props
 * @param props.label - the cell's accessible name
 * @param props.pressed - whether the cell is currently a number
 * @param props.onClick - switches the cell's type
 * @returns the rendered toggle button
 */
function NumberToggle({ label, pressed, onClick }: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={`${label} as number`}
      aria-pressed={pressed}
      title={pressed ? 'Number cell. Click to make it text.' : 'Text cell. Click to make it a number.'}
      onClick={onClick}
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
        pressed ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Hash className="h-3 w-3" />
    </button>
  );
}
