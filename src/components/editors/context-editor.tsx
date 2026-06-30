import { Image as ImageIcon, Trash2, Type as TypeIcon } from 'lucide-react';
import type { ContextBlock } from 'slack-web-api-client';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import { Textarea } from '../../lib/ui/textarea';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

type TextElement = {
  type: 'mrkdwn' | 'plain_text';
  text: string;
  emoji?: boolean;
};

type ImageElement = {
  type: 'image';
  image_url: string;
  alt_text: string;
};

/**
 * Editor form for context blocks. Supports the two element types we
 * actually emit from the palette:
 *  - Text (mrkdwn or plain_text), edited as a textarea with a small
 *    type toggle so users can switch between formatted and plain.
 *  - Image (URL + alt text).
 *
 * Slack-file image elements (the upload variant) and any other element
 * shape are preserved as-is on save but shown as read-only with a note.
 * @param props - editor props
 * @param props.block - the context block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered context editor form
 */
export function ContextEditor({ block, onChange }: BlockEditorProps<ContextBlock>) {
  const elements = block.elements ?? [];

  const updateAt = <T extends ContextBlock['elements'][number]>(idx: number, updater: (el: T) => T) => {
    const next = elements.map((el, i) => (i === idx ? updater(el as T) : el));
    onChange({ ...block, elements: next });
  };

  const removeAt = (idx: number) => {
    onChange({ ...block, elements: elements.filter((_, i) => i !== idx) });
  };

  const addText = () => {
    const newEl: TextElement = { type: 'mrkdwn', text: 'More context' };
    onChange({ ...block, elements: [...elements, newEl] });
  };

  const addImage = () => {
    const newEl: ImageElement = {
      type: 'image',
      image_url: 'https://placehold.co/40x40?text=A',
      alt_text: 'Avatar'
    };
    onChange({ ...block, elements: [...elements, newEl] });
  };

  return (
    <div className="flex flex-col gap-3">
      <EditorField
        label="Items"
        help="Shown in a horizontal row, usually as footnote-style content. Slack supports up to 10 items."
      >
        <div className="flex flex-col gap-2">
          {elements.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
              No items yet — a context block needs at least one. Add text or an image below, or delete the block if you
              don't need it.
            </p>
          ) : null}
          {elements.map((el, idx) => {
            if (el.type === 'mrkdwn' || el.type === 'plain_text') {
              return (
                <TextItemCard
                  key={idx}
                  index={idx}
                  element={el as TextElement}
                  onChange={(next) => updateAt<TextElement>(idx, () => next)}
                  onRemove={() => removeAt(idx)}
                />
              );
            }
            if (el.type === 'image' && 'image_url' in el) {
              return (
                <ImageItemCard
                  key={idx}
                  index={idx}
                  element={el as ImageElement}
                  onChange={(next) => updateAt<ImageElement>(idx, () => next)}
                  onRemove={() => removeAt(idx)}
                />
              );
            }
            return (
              <div
                key={idx}
                className="flex items-center justify-between rounded border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground"
              >
                <span>Item not editable in the visual builder</span>
                <button
                  type="button"
                  aria-label="Remove item"
                  onClick={() => removeAt(idx)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </EditorField>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={addText} className="self-start">
          <TypeIcon className="h-3.5 w-3.5" /> Add text
        </Button>
        <Button type="button" size="sm" onClick={addImage} className="self-start">
          <ImageIcon className="h-3.5 w-3.5" /> Add image
        </Button>
      </div>
    </div>
  );
}

/**
 * Card UI for a single text-type context item with format toggle.
 * @param props - item props
 * @param props.index - position of the item within the context block
 * @param props.element - the text element being edited
 * @param props.onChange - called with the updated element
 * @param props.onRemove - called when the user removes the item
 * @returns the rendered text item card
 */
function TextItemCard({
  index,
  element,
  onChange,
  onRemove
}: {
  index: number;
  element: TextElement;
  onChange: (next: TextElement) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
          <TypeIcon className="h-3 w-3" /> Text item {index + 1}
        </span>
        <button
          type="button"
          aria-label="Remove item"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorField label="Text" htmlFor={`ctx-text-${index}`}>
        <Textarea
          id={`ctx-text-${index}`}
          value={element.text}
          rows={2}
          placeholder="e.g. Posted by @riley"
          onChange={(e) => onChange({ ...element, text: e.target.value })}
        />
      </EditorField>
      <EditorField
        label="Format"
        help="Markdown enables *bold*, _italic_, links, mentions, etc. Plain text shows the characters as-is."
      >
        <RadioGroup
          value={element.type}
          onValueChange={(v) => {
            const nextType: TextElement['type'] = v === 'plain_text' ? 'plain_text' : 'mrkdwn';
            const next: TextElement = { type: nextType, text: element.text };
            if (nextType === 'plain_text') {
              next.emoji = true;
            }
            onChange(next);
          }}
          className="flex flex-row gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="mrkdwn" id={`ctx-fmt-${index}-mrkdwn`} />
            <Label htmlFor={`ctx-fmt-${index}-mrkdwn`} className="text-xs font-normal">
              Markdown
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="plain_text" id={`ctx-fmt-${index}-plain`} />
            <Label htmlFor={`ctx-fmt-${index}-plain`} className="text-xs font-normal">
              Plain text
            </Label>
          </div>
        </RadioGroup>
      </EditorField>
    </div>
  );
}

/**
 * Card UI for a single image-type context item with URL and alt text fields.
 * @param props - item props
 * @param props.index - position of the item within the context block
 * @param props.element - the image element being edited
 * @param props.onChange - called with the updated element
 * @param props.onRemove - called when the user removes the item
 * @returns the rendered image item card
 */
function ImageItemCard({
  index,
  element,
  onChange,
  onRemove
}: {
  index: number;
  element: ImageElement;
  onChange: (next: ImageElement) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
          <ImageIcon className="h-3 w-3" /> Image item {index + 1}
        </span>
        <button
          type="button"
          aria-label="Remove item"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorField
        label="Image URL"
        help="A publicly accessible image URL. Best at small sizes (around 20px)."
        htmlFor={`ctx-img-url-${index}`}
      >
        <Input
          id={`ctx-img-url-${index}`}
          type="url"
          value={element.image_url}
          placeholder="e.g. https://example.com/avatar.png"
          onChange={(e) => onChange({ ...element, image_url: e.target.value })}
        />
      </EditorField>
      <EditorField label="Alt text" help="Describes the image for screen readers." htmlFor={`ctx-img-alt-${index}`}>
        <Input
          id={`ctx-img-alt-${index}`}
          value={element.alt_text}
          placeholder="e.g. Riley's avatar"
          onChange={(e) => onChange({ ...element, alt_text: e.target.value })}
        />
      </EditorField>
    </div>
  );
}
