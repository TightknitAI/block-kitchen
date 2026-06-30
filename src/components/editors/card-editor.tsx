import { CARD_ACTIONS_MAX } from '@tightknitai/slack-block-kit-validator';
import { Plus, Trash2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { ImageElement, Button as SlackButton } from 'slack-web-api-client';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import { Textarea } from '../../lib/ui/textarea';
import type { CardBlock } from '../../types';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

type ButtonStyle = 'default' | 'primary' | 'danger';

/**
 * Editor form for card blocks. Edits title, subtitle, body, hero image,
 * icon, and a list of button actions. At least one of hero image, title,
 * actions, or body must be set; the validator surfaces this constraint.
 *
 * `idPrefix` namespaces the input ids so the editor can be rendered more
 * than once on a page (the carousel editor reuses it per card); it
 * defaults to `card` for the standalone block.
 * @param props - editor props
 * @param props.block - the card block to edit
 * @param props.onChange - called with the updated block payload
 * @param props.idPrefix - prefix for input ids (defaults to `card`)
 * @returns the rendered card editor form
 */
export function CardEditor({
  block,
  onChange,
  idPrefix = 'card'
}: BlockEditorProps<CardBlock> & { idPrefix?: string }) {
  return (
    <div className="flex flex-col gap-4">
      <EditorField label="Title" help="Up to 150 characters. Supports mrkdwn formatting." htmlFor={`${idPrefix}-title`}>
        <Input
          id={`${idPrefix}-title`}
          value={block.title?.text ?? ''}
          maxLength={150}
          placeholder="e.g. New launch update"
          onChange={(e) =>
            onChange({
              ...block,
              title: e.target.value ? { type: 'mrkdwn', text: e.target.value } : undefined
            })
          }
        />
      </EditorField>

      <EditorField label="Subtitle" help="Up to 150 characters." htmlFor={`${idPrefix}-subtitle`}>
        <Input
          id={`${idPrefix}-subtitle`}
          value={block.subtitle?.text ?? ''}
          maxLength={150}
          placeholder="e.g. Released April 28"
          onChange={(e) =>
            onChange({
              ...block,
              subtitle: e.target.value ? { type: 'mrkdwn', text: e.target.value } : undefined
            })
          }
        />
      </EditorField>

      <EditorField label="Body" help="Up to 200 characters. Supports mrkdwn formatting." htmlFor={`${idPrefix}-body`}>
        <Textarea
          id={`${idPrefix}-body`}
          value={block.body?.text ?? ''}
          maxLength={200}
          rows={3}
          placeholder="e.g. Read the announcement to see what's new."
          onChange={(e) =>
            onChange({
              ...block,
              body: e.target.value ? { type: 'mrkdwn', text: e.target.value } : undefined
            })
          }
        />
      </EditorField>

      <ImageFields
        label="Hero image"
        help="Wide image displayed at the top of the card."
        idPrefix={`${idPrefix}-hero`}
        image={block.hero_image}
        onChange={(next) => onChange({ ...block, hero_image: next })}
      />

      <ImageFields
        label="Icon"
        help="Small image shown next to the title."
        idPrefix={`${idPrefix}-icon`}
        image={block.icon}
        onChange={(next) => onChange({ ...block, icon: next })}
      />

      <ButtonsField
        idPrefix={idPrefix}
        buttons={block.actions ?? []}
        onChange={(next) => onChange({ ...block, actions: next.length > 0 ? next : undefined })}
      />
    </div>
  );
}

/**
 * Optional image sub-editor used for the card's hero image and icon.
 * Editing the URL with the image previously unset creates the field;
 * clearing it back to empty removes the image.
 * @param props - field props
 * @param props.label - the field label
 * @param props.help - help text below the label
 * @param props.idPrefix - prefix for input ids (avoids collisions)
 * @param props.image - current image element, if any
 * @param props.onChange - called with the next image element (or undefined to clear)
 * @returns the rendered image fields
 */
function ImageFields({
  label,
  help,
  idPrefix,
  image,
  onChange
}: {
  label: string;
  help: string;
  idPrefix: string;
  image: ImageElement | undefined;
  onChange: (next: ImageElement | undefined) => void;
}) {
  if (image && !('image_url' in image)) {
    return (
      <p className="text-[11px] leading-snug text-muted-foreground">
        {label} references a Slack file. Not editable in the visual builder.
      </p>
    );
  }
  const url = image?.image_url ?? '';
  const alt = image?.alt_text ?? '';

  const update = (next: { url?: string; alt?: string }) => {
    const nextUrl = next.url ?? url;
    const nextAlt = next.alt ?? alt;
    if (!nextUrl && !nextAlt) {
      onChange(undefined);
      return;
    }
    onChange({
      type: 'image',
      image_url: nextUrl,
      alt_text: nextAlt || label
    });
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <EditorField label={label} help={help} htmlFor={`${idPrefix}-url`}>
        <Input
          id={`${idPrefix}-url`}
          type="url"
          value={url}
          placeholder="e.g. https://example.com/image.png"
          onChange={(e) => update({ url: e.target.value })}
        />
      </EditorField>
      <EditorField label="Alt text" help="Describes the image for screen readers." htmlFor={`${idPrefix}-alt`}>
        <Input
          id={`${idPrefix}-alt`}
          value={alt}
          placeholder="e.g. Product screenshot"
          onChange={(e) => update({ alt: e.target.value })}
        />
      </EditorField>
    </div>
  );
}

/**
 * Sub-editor for the card's `actions` button list. Mirrors the
 * patterns used by {@link ActionsEditor} but scoped to button elements
 * since cards only accept buttons.
 * @param props - field props
 * @param props.buttons - current actions array
 * @param props.onChange - called with the updated actions array
 * @returns the rendered actions editor
 */
function ButtonsField({
  buttons,
  onChange,
  idPrefix = 'card'
}: {
  buttons: SlackButton[];
  onChange: (next: SlackButton[]) => void;
  idPrefix?: string;
}) {
  const update = (idx: number, change: Partial<SlackButton>) => {
    onChange(buttons.map((b, i) => (i === idx ? { ...b, ...change } : b)));
  };
  const removeAt = (idx: number) => onChange(buttons.filter((_, i) => i !== idx));
  const atLimit = buttons.length >= CARD_ACTIONS_MAX;
  // Random suffix so re-adding after a delete can't collide with a surviving
  // button's action_id (Slack rejects duplicates in the same view/message).
  const addButton = () => {
    if (atLimit) {
      return;
    }
    onChange([
      ...buttons,
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Click me', emoji: true },
        action_id: `card_action_${nanoid(6)}`
      }
    ]);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <span className="text-xs font-medium text-foreground">Actions</span>
      {buttons.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          No buttons. Add one to render an action row at the bottom of the card.
        </p>
      ) : null}
      {buttons.map((btn, idx) => {
        const label = btn.text?.text ?? '';
        const url = btn.url ?? '';
        const style: ButtonStyle = btn.style === 'primary' || btn.style === 'danger' ? btn.style : 'default';
        return (
          <div key={idx} className="flex flex-col gap-2 rounded border bg-background p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Button {idx + 1}</span>
              <button
                type="button"
                aria-label="Remove button"
                onClick={() => removeAt(idx)}
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <EditorField label="Label" htmlFor={`${idPrefix}-btn-label-${idx}`}>
              <Input
                id={`${idPrefix}-btn-label-${idx}`}
                value={label}
                placeholder="e.g. Open"
                onChange={(e) =>
                  update(idx, {
                    text: {
                      type: 'plain_text',
                      text: e.target.value,
                      emoji: true
                    }
                  })
                }
              />
            </EditorField>
            <EditorField
              label="Link URL"
              help="Optional. If set, the button opens this link."
              htmlFor={`${idPrefix}-btn-url-${idx}`}
            >
              <Input
                id={`${idPrefix}-btn-url-${idx}`}
                type="url"
                value={url}
                placeholder="e.g. https://example.com"
                onChange={(e) => update(idx, { url: e.target.value || undefined })}
              />
            </EditorField>
            <EditorField label="Style">
              <RadioGroup
                value={style}
                onValueChange={(v) => {
                  const nextStyle: 'primary' | 'danger' | undefined = v === 'primary' || v === 'danger' ? v : undefined;
                  update(idx, { style: nextStyle });
                }}
                className="flex flex-row gap-3"
              >
                {(['default', 'primary', 'danger'] as const).map((s) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <RadioGroupItem value={s} id={`${idPrefix}-btn-style-${idx}-${s}`} />
                    <Label htmlFor={`${idPrefix}-btn-style-${idx}-${s}`} className="text-xs capitalize">
                      {s}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </EditorField>
          </div>
        );
      })}
      <Button type="button" size="sm" onClick={addButton} disabled={atLimit} className="self-start">
        <Plus className="h-3.5 w-3.5" /> Add button
      </Button>
      {atLimit ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Card blocks support up to {CARD_ACTIONS_MAX} action buttons.
        </p>
      ) : null}
    </div>
  );
}
