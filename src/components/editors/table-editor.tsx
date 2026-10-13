import type { TableBlock, TableCell, TableColumnSetting } from '../../types';
import { CellGrid, CellTextInput, type ColumnEdit } from './cell-grid';
import type { BlockEditorProps } from './types';

const ALIGN_OPTIONS: ('left' | 'center' | 'right')[] = ['left', 'center', 'right'];

/**
 * Keeps `column_settings` aligned with the cells after a column is added
 * (a `null` setting) or removed (its setting dropped).
 * @param settings - the current column settings
 * @param edit - the column edit just applied to the cells
 * @returns the realigned column settings
 */
function alignColumnSettings(settings: TableColumnSetting[], edit: ColumnEdit): TableColumnSetting[] {
  return edit.kind === 'add' ? [...settings, null] : settings.filter((_, c) => c !== edit.index);
}

/**
 * Editor form for table blocks. v1 surfaces:
 *  - The grid as a 2D array of inputs (raw_text cells).
 *  - Per-column alignment (left / center / right) and an "add column" button.
 *  - Per-row delete and an "add row" button.
 *
 * Rich-text cells are shown as a read-only placeholder and preserved on
 * save unless the user edits them, in which case they're replaced with a
 * raw_text cell containing the new value.
 * @param props - editor props
 * @param props.block - the table block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered table editor form
 */
export function TableEditor({ block, onChange }: BlockEditorProps<TableBlock>) {
  const rows = block.rows ?? [];
  const columnCount = rows[0]?.length ?? 0;
  const columnSettings = block.column_settings ?? [];

  const setColumnAlign = (colIdx: number, align: 'left' | 'center' | 'right' | '') => {
    const next: TableColumnSetting[] = Array.from({ length: columnCount }, (_, i) => columnSettings[i] ?? null);
    if (align === '') {
      next[colIdx] = null;
    } else {
      const existing = (next[colIdx] ?? {}) as Exclude<TableColumnSetting, null>;
      next[colIdx] = { ...existing, align };
    }
    onChange({ ...block, column_settings: next });
  };

  return (
    <CellGrid<TableCell>
      label="Cells"
      help="Up to 100 rows and 20 columns. Slack allows one table per message."
      rows={rows}
      minRows={1}
      maxRows={100}
      maxColumns={20}
      blankCell={() => ({ type: 'raw_text', text: '' })}
      onChange={(nextRows, edit) =>
        onChange({
          ...block,
          rows: nextRows,
          ...(edit ? { column_settings: alignColumnSettings(columnSettings, edit) } : {})
        })
      }
      renderColumnControl={(c) => (
        <select
          aria-label={`Column ${c + 1} alignment`}
          value={columnSettings[c]?.align ?? ''}
          onChange={(e) => setColumnAlign(c, e.target.value as 'left' | 'center' | 'right' | '')}
          className="h-7 flex-1 rounded-sm border border-input bg-background px-1.5 text-[11px] text-muted-foreground"
        >
          <option value="">Default</option>
          {ALIGN_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
      renderCell={(cell, { row, col, label }, update) => (
        <CellTextInput
          cell={cell}
          label={label}
          placeholder={row === 0 ? `Header ${col + 1}` : 'Cell text'}
          onChange={update}
        />
      )}
    />
  );
}
