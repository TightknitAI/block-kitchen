import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import type {
  CartesianChart,
  Chart,
  ChartSeries,
  ChartType,
  DataVisualizationBlock,
  PieChart,
  PieChartSegment
} from '../../types';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

const CHART_TYPES: readonly ChartType[] = ['line', 'bar', 'area', 'pie'] as const;

/** Narrows a chart to its cartesian (line / bar / area) variant. */
function isCartesian(chart: Chart): chart is CartesianChart {
  return chart.type !== 'pie';
}

/** Flattens a cartesian chart's first series into pie segments. */
function cartesianToSegments(chart: CartesianChart): PieChartSegment[] {
  return (chart.series[0]?.data ?? []).map((d) => ({ label: d.label, value: d.value }));
}

/** Builds a single-series cartesian chart from pie segments. */
function segmentsToCartesian(type: CartesianChart['type'], segments: PieChartSegment[]): CartesianChart {
  return {
    type,
    series: [{ name: 'Series 1', data: segments.map((s) => ({ label: s.label, value: s.value })) }],
    axis_config: { categories: segments.map((s) => s.label) }
  };
}

/**
 * Converts the current chart to a new chart type, preserving the data
 * where the shapes are compatible: line / bar / area share the same
 * series shape, while switching to or from pie maps between series data
 * and segments so a user doesn't lose their numbers mid-edit.
 */
function convertChart(chart: Chart, nextType: ChartType): Chart {
  if (nextType === chart.type) {
    return chart;
  }
  if (nextType === 'pie') {
    return { type: 'pie', segments: isCartesian(chart) ? cartesianToSegments(chart) : chart.segments };
  }
  if (isCartesian(chart)) {
    return { ...chart, type: nextType };
  }
  return segmentsToCartesian(nextType, chart.segments);
}

/**
 * Editor form for `data_visualization` blocks. Edits the title, the chart
 * type (line / bar / area / pie), and the underlying data — a category ×
 * series grid for the cartesian charts, or a flat segment list for pie.
 * @param props - editor props
 * @param props.block - the data visualization block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered data visualization editor form
 */
export function DataVisualizationEditor({ block, onChange }: BlockEditorProps<DataVisualizationBlock>) {
  const { chart } = block;
  const setChart = (next: Chart) => onChange({ ...block, chart: next });

  return (
    <div className="flex flex-col gap-4">
      <EditorField label="Title" help="Heading shown above the chart." htmlFor="dataviz-title">
        <Input
          id="dataviz-title"
          value={block.title}
          placeholder="e.g. Weekly active users"
          onChange={(e) => onChange({ ...block, title: e.target.value })}
        />
      </EditorField>

      <EditorField label="Chart type">
        <RadioGroup
          value={chart.type}
          onValueChange={(v) => setChart(convertChart(chart, v as ChartType))}
          className="flex flex-row flex-wrap gap-3"
        >
          {CHART_TYPES.map((t) => (
            <div key={t} className="flex items-center gap-1.5">
              <RadioGroupItem value={t} id={`dataviz-type-${t}`} />
              <Label htmlFor={`dataviz-type-${t}`} className="text-xs capitalize">
                {t}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>

      {isCartesian(chart) ? (
        <CartesianFields chart={chart} onChange={setChart} />
      ) : (
        <PieFields chart={chart} onChange={setChart} />
      )}
    </div>
  );
}

/**
 * Numeric input that keeps a local string draft so partial values like a
 * lone "-" type cleanly. Commits a parsed number on every valid keystroke
 * and normalizes (empty / invalid → 0) on blur. Resyncs when the model
 * value changes from outside (e.g. a chart-type switch or row reindex).
 */
function NumberInput({
  id,
  value,
  onCommit,
  ariaLabel,
  className
}: {
  id?: string;
  value: number;
  onCommit: (next: number) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <Input
      id={id}
      type="number"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={draft}
      className={className}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        // Skip intermediate states that don't parse to a number yet.
        if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
          return;
        }
        const next = Number(raw);
        if (!Number.isNaN(next)) {
          onCommit(next);
        }
      }}
      onBlur={() => {
        const next = Number(draft);
        const safe = draft.trim() === '' || Number.isNaN(next) ? 0 : next;
        onCommit(safe);
        setDraft(String(safe));
      }}
    />
  );
}

/**
 * Sub-editor for line / bar / area charts. Presents the data as a grid:
 * categories are the x-axis columns, each series is a row, and every cell
 * is a numeric value. Series data is kept aligned to the category spine on
 * every edit so the payload always has one value per category.
 */
function CartesianFields({ chart, onChange }: { chart: CartesianChart; onChange: (next: CartesianChart) => void }) {
  const series = chart.series;
  // Categories drive the x-axis. Fall back to the first series' labels so a
  // block loaded without axis_config still shows (and keeps) its data.
  const categories =
    chart.axis_config?.categories && chart.axis_config.categories.length > 0
      ? chart.axis_config.categories
      : (series[0]?.data.map((d) => d.label) ?? []);
  const xLabel = chart.axis_config?.x_label ?? '';
  const yLabel = chart.axis_config?.y_label ?? '';

  // Single write path: re-align every series to the category spine and
  // rebuild axis_config, dropping empty axis labels.
  const commit = (
    nextCategories: string[],
    nextSeries: ChartSeries[],
    axis?: { x_label?: string; y_label?: string }
  ) => {
    const aligned: ChartSeries[] = nextSeries.map((s) => ({
      name: s.name,
      data: nextCategories.map((label, i) => ({ label, value: s.data[i]?.value ?? 0 }))
    }));
    const x = axis?.x_label ?? xLabel;
    const y = axis?.y_label ?? yLabel;
    onChange({
      type: chart.type,
      series: aligned,
      axis_config: {
        categories: nextCategories,
        ...(x ? { x_label: x } : {}),
        ...(y ? { y_label: y } : {})
      }
    });
  };

  const setCategory = (col: number, label: string) =>
    commit(
      categories.map((c, i) => (i === col ? label : c)),
      series
    );
  const addCategory = () => commit([...categories, `Cat ${categories.length + 1}`], series);
  const removeCategory = (col: number) =>
    commit(
      categories.filter((_, i) => i !== col),
      series.map((s) => ({ name: s.name, data: s.data.filter((_, i) => i !== col) }))
    );
  const setCell = (seriesIdx: number, col: number, value: number) =>
    commit(
      categories,
      series.map((s, i) =>
        i === seriesIdx ? { name: s.name, data: s.data.map((d, j) => (j === col ? { ...d, value } : d)) } : s
      )
    );
  const setSeriesName = (seriesIdx: number, name: string) =>
    commit(
      categories,
      series.map((s, i) => (i === seriesIdx ? { ...s, name } : s))
    );
  const addSeries = () =>
    commit(categories, [
      ...series,
      { name: `Series ${series.length + 1}`, data: categories.map((label) => ({ label, value: 0 })) }
    ]);
  const removeSeries = (seriesIdx: number) =>
    commit(
      categories,
      series.filter((_, i) => i !== seriesIdx)
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <EditorField label="X-axis label" htmlFor="dataviz-x-label">
            <Input
              id="dataviz-x-label"
              value={xLabel}
              placeholder="e.g. Day"
              onChange={(e) => commit(categories, series, { x_label: e.target.value })}
            />
          </EditorField>
        </div>
        <div className="flex-1">
          <EditorField label="Y-axis label" htmlFor="dataviz-y-label">
            <Input
              id="dataviz-y-label"
              value={yLabel}
              placeholder="e.g. Users"
              onChange={(e) => commit(categories, series, { y_label: e.target.value })}
            />
          </EditorField>
        </div>
      </div>

      <EditorField label="Data" help="Categories are the x-axis; each series is plotted across them.">
        <div className="flex flex-col gap-2 overflow-x-auto">
          {/* Category header row */}
          <div className="flex items-center gap-1">
            <span className="w-36 shrink-0" aria-hidden="true" />
            {categories.map((cat, c) => (
              <div key={c} className="flex min-w-[88px] flex-1 items-center gap-1">
                <Input
                  aria-label={`Category ${c + 1}`}
                  value={cat}
                  placeholder={`Cat ${c + 1}`}
                  onChange={(e) => setCategory(c, e.target.value)}
                  className="h-8 text-xs"
                />
                <button
                  type="button"
                  aria-label={`Remove category ${c + 1}`}
                  onClick={() => removeCategory(c)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* One row per series */}
          {series.map((s, si) => (
            <div key={si} className="flex items-center gap-1">
              <div className="flex w-36 shrink-0 items-center gap-1">
                <Input
                  aria-label={`Series ${si + 1} name`}
                  value={s.name}
                  placeholder={`Series ${si + 1}`}
                  onChange={(e) => setSeriesName(si, e.target.value)}
                  className="h-8 text-xs"
                />
                <button
                  type="button"
                  aria-label={`Remove series ${si + 1}`}
                  onClick={() => removeSeries(si)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              {categories.map((cat, c) => (
                <div key={c} className="min-w-[88px] flex-1">
                  <NumberInput
                    value={s.data[c]?.value ?? 0}
                    onCommit={(n) => setCell(si, c, n)}
                    ariaLabel={`${s.name || `Series ${si + 1}`} value for ${cat || `category ${c + 1}`}`}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </EditorField>

      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={addSeries} className="self-start">
          <Plus className="h-3.5 w-3.5" /> Add series
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={addCategory} className="self-start">
          <Plus className="h-3.5 w-3.5" /> Add category
        </Button>
      </div>
    </div>
  );
}

/**
 * Sub-editor for pie charts. Edits the flat list of `{ label, value }`
 * segments with add / remove controls.
 */
function PieFields({ chart, onChange }: { chart: PieChart; onChange: (next: PieChart) => void }) {
  const segments = chart.segments;

  const setSegment = (idx: number, change: Partial<PieChartSegment>) =>
    onChange({ ...chart, segments: segments.map((s, i) => (i === idx ? { ...s, ...change } : s)) });
  const removeSegment = (idx: number) => onChange({ ...chart, segments: segments.filter((_, i) => i !== idx) });
  const addSegment = () =>
    onChange({ ...chart, segments: [...segments, { label: `Segment ${segments.length + 1}`, value: 0 }] });

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <span className="text-xs font-medium text-foreground">Segments</span>
      {segments.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">No segments. Add one to render a slice.</p>
      ) : null}
      {segments.map((seg, idx) => (
        <div key={idx} className="flex flex-col gap-2 rounded border bg-background p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Segment {idx + 1}</span>
            <button
              type="button"
              aria-label="Remove segment"
              onClick={() => removeSegment(idx)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <EditorField label="Label" htmlFor={`pie-label-${idx}`}>
                <Input
                  id={`pie-label-${idx}`}
                  value={seg.label}
                  placeholder="e.g. Free"
                  onChange={(e) => setSegment(idx, { label: e.target.value })}
                />
              </EditorField>
            </div>
            <div className="w-28">
              <EditorField label="Value" htmlFor={`pie-value-${idx}`}>
                <NumberInput
                  id={`pie-value-${idx}`}
                  value={seg.value}
                  onCommit={(n) => setSegment(idx, { value: n })}
                  ariaLabel={`Segment ${idx + 1} value`}
                />
              </EditorField>
            </div>
          </div>
        </div>
      ))}
      <Button type="button" size="sm" onClick={addSegment} className="self-start">
        <Plus className="h-3.5 w-3.5" /> Add segment
      </Button>
    </div>
  );
}
