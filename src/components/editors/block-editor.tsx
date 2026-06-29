import type {
  ActionsBlock,
  ContextBlock,
  HeaderBlock,
  ImageBlock,
  RichTextBlock,
  SectionBlock
} from 'slack-web-api-client';
import { labelForBlockType } from '../../lib/default-blocks';
import type {
  AlertBlock,
  CardBlock,
  CarouselBlock,
  ContainerBlock,
  ContextActionsBlock,
  DataVisualizationBlock,
  InputBlock,
  MarkdownBlock,
  PlanBlock,
  SupportedBlock,
  SupportedBlockType,
  TableBlock,
  TaskCardBlock,
  VideoBlock
} from '../../types';
import { ActionsEditor } from './actions-editor';
import { AlertEditor } from './alert-editor';
import { CardEditor } from './card-editor';
import { CarouselEditor } from './carousel-editor';
import { ContainerEditor } from './container-editor';
import { ContextActionsEditor } from './context-actions-editor';
import { ContextEditor } from './context-editor';
import { DataVisualizationEditor } from './data-visualization-editor';
import { DividerEditor } from './divider-editor';
import { HeaderEditor } from './header-editor';
import { ImageEditor } from './image-editor';
import { InputEditor } from './input-editor';
import { MarkdownEditor } from './markdown-editor';
import { PlanEditor } from './plan-editor';
import { RichTextEditor } from './rich-text-editor';
import { SectionEditor } from './section-editor';
import { TableEditor } from './table-editor';
import { TaskCardEditor } from './task-card-editor';
import { VideoEditor } from './video-editor';

/**
 * Dispatches to the correct per-block editor form. Provides a consistent
 * header (block type label) and surfaces this block's validation errors
 * so the popover feels unified.
 * @param props - editor props
 * @param props.block - the block being edited
 * @param props.errors - validation errors for this block, if any
 * @param props.onChange - called with the updated block
 * @returns the rendered editor for the block's type
 */
export function BlockEditor({
  block,
  errors,
  onChange
}: {
  block: SupportedBlock;
  errors?: string[];
  onChange: (next: SupportedBlock) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Edit {labelForBlockType(block.type as SupportedBlockType)}
        </h3>
      </div>
      {errors && errors.length > 0 ? (
        <ul className="flex flex-col gap-0.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      ) : null}
      {dispatch(block, onChange)}
    </div>
  );
}

/**
 * Picks the per-block editor form based on `block.type`.
 * @param block - the block being edited
 * @param onChange - called with the updated block payload
 * @returns the editor element for the block, or null for unsupported types
 */
function dispatch(block: SupportedBlock, onChange: (next: SupportedBlock) => void) {
  switch (block.type) {
    case 'section':
      return <SectionEditor block={block as SectionBlock} onChange={(next) => onChange(next)} />;
    case 'header':
      return <HeaderEditor block={block as HeaderBlock} onChange={(next) => onChange(next)} />;
    case 'divider':
      return <DividerEditor />;
    case 'context':
      return <ContextEditor block={block as ContextBlock} onChange={(next) => onChange(next)} />;
    case 'actions':
      return <ActionsEditor block={block as ActionsBlock} onChange={(next) => onChange(next)} />;
    case 'image':
      return <ImageEditor block={block as ImageBlock} onChange={(next) => onChange(next)} />;
    case 'markdown':
      return <MarkdownEditor block={block as MarkdownBlock} onChange={(next) => onChange(next)} />;
    case 'rich_text':
      return <RichTextEditor block={block as RichTextBlock} onChange={(next) => onChange(next)} />;
    case 'table':
      return <TableEditor block={block as TableBlock} onChange={(next) => onChange(next)} />;
    case 'alert':
      return <AlertEditor block={block as AlertBlock} onChange={(next) => onChange(next)} />;
    case 'card':
      return <CardEditor block={block as CardBlock} onChange={(next) => onChange(next)} />;
    case 'carousel':
      return <CarouselEditor block={block as CarouselBlock} onChange={(next) => onChange(next)} />;
    case 'context_actions':
      return <ContextActionsEditor block={block as ContextActionsBlock} onChange={(next) => onChange(next)} />;
    case 'input':
      return <InputEditor block={block as InputBlock} onChange={(next) => onChange(next)} />;
    case 'video':
      return <VideoEditor block={block as VideoBlock} onChange={(next) => onChange(next)} />;
    case 'plan':
      return <PlanEditor block={block as PlanBlock} onChange={(next) => onChange(next)} />;
    case 'task_card':
      return <TaskCardEditor block={block as TaskCardBlock} onChange={(next) => onChange(next)} />;
    case 'data_visualization':
      return <DataVisualizationEditor block={block as DataVisualizationBlock} onChange={(next) => onChange(next)} />;
    case 'container':
      return <ContainerEditor block={block as ContainerBlock} onChange={(next) => onChange(next)} />;
    default:
      return null;
  }
}
