import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../lib/ui/button';
import type { CardBlock, CarouselBlock } from '../../types';
import { CardEditor } from './card-editor';
import type { BlockEditorProps } from './types';

const MAX_CARDS = 10;

/**
 * Editor form for carousel blocks. Lists the contained cards and lets
 * the user add, remove, and edit each one with the full standalone Card
 * editor (title, subtitle, body, hero image, icon, and action buttons).
 * @param props - editor props
 * @param props.block - the carousel block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered carousel editor form
 */
export function CarouselEditor({ block, onChange }: BlockEditorProps<CarouselBlock>) {
  const elements = block.elements ?? [];

  const updateCard = (idx: number, next: CardBlock) => {
    onChange({
      ...block,
      elements: elements.map((c, i) => (i === idx ? next : c))
    });
  };
  const removeAt = (idx: number) => {
    onChange({
      ...block,
      elements: elements.filter((_, i) => i !== idx)
    });
  };
  const addCard = () => {
    onChange({
      ...block,
      elements: [
        ...elements,
        {
          type: 'card',
          title: {
            type: 'mrkdwn',
            text: `Card ${elements.length + 1}`
          },
          body: { type: 'mrkdwn', text: 'New card.' }
        }
      ]
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] leading-snug text-muted-foreground">Carousels hold 1-10 cards.</p>
      {elements.map((card, idx) => (
        <div key={idx} className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Card {idx + 1}</span>
            <button
              type="button"
              aria-label="Remove card"
              onClick={() => removeAt(idx)}
              disabled={elements.length <= 1}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <CardEditor block={card} idPrefix={`carousel-card-${idx}`} onChange={(next) => updateCard(idx, next)} />
        </div>
      ))}
      <Button type="button" size="sm" onClick={addCard} disabled={elements.length >= MAX_CARDS} className="self-start">
        <Plus className="h-3.5 w-3.5" /> Add card
      </Button>
    </div>
  );
}
