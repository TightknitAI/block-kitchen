import { useRef } from 'react';
import type { ImageElement, SectionBlock, Button as SlackButton } from 'slack-web-api-client';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import { Textarea } from '../../lib/ui/textarea';
import { EmojiTextInsertButton } from '../emoji/emoji-text-insert-button';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

type AccessoryKind = 'none' | 'button' | 'image' | 'other';
type ButtonStyle = 'default' | 'primary' | 'danger';

/**
 * Maps a section block's accessory payload to the {@link AccessoryKind}
 * the editor UI uses, with 'other' for accessory types not yet
 * supported in the visual builder.
 * @param accessory - the section's accessory payload, if any
 * @returns the accessory kind for the radio group
 */
function detectAccessory(accessory: SectionBlock['accessory']): AccessoryKind {
  if (!accessory) {
    return 'none';
  }
  if (accessory.type === 'button') {
    return 'button';
  }
  if (accessory.type === 'image') {
    return 'image';
  }
  return 'other';
}

/**
 * A sensible default Button accessory the editor swaps in when the
 * user picks "Button" from the accessory radio.
 * @returns a fresh button accessory payload
 */
function defaultButton(): SlackButton {
  return {
    type: 'button',
    text: { type: 'plain_text', text: 'Click me', emoji: true },
    action_id: 'section_button'
  };
}

/**
 * A sensible default Image accessory the editor swaps in when the
 * user picks "Image" from the accessory radio.
 * @returns a fresh image accessory payload
 */
function defaultImage(): ImageElement {
  return {
    type: 'image',
    image_url: 'https://placehold.co/96x96',
    alt_text: 'Accessory image'
  };
}

/**
 * Editor form for section blocks. Edits the primary mrkdwn text and
 * an optional accessory (Button or Image, the two most common
 * accessories on real Slack sections). Other accessory types
 * (overflow, selects, datepickers, etc.) are preserved on the block
 * but flagged as not editable in the visual builder.
 * @param props - editor props
 * @param props.block - the section block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered section editor form
 */
export function SectionEditor({ block, onChange }: BlockEditorProps<SectionBlock>) {
  const text = block.text?.text ?? '';
  const accessoryKind = detectAccessory(block.accessory);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const setText = (next: string) => onChange({ ...block, text: { type: 'mrkdwn', text: next } });

  const setAccessoryKind = (next: AccessoryKind) => {
    if (next === accessoryKind) {
      return;
    }
    if (next === 'none') {
      onChange({ ...block, accessory: undefined });
      return;
    }
    if (next === 'button') {
      onChange({ ...block, accessory: defaultButton() });
      return;
    }
    if (next === 'image') {
      onChange({ ...block, accessory: defaultImage() });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <EditorField
        label="Text"
        help="Supports *bold*, _italic_, ~strike~, `code`, and <url|link> formatting."
        htmlFor="section-text"
      >
        <div className="flex items-start gap-1.5">
          <Textarea
            ref={textRef}
            id="section-text"
            value={text}
            rows={4}
            placeholder="e.g. Welcome to the channel! Ping <@U123> with any questions."
            onChange={(e) => setText(e.target.value)}
          />
          <EmojiTextInsertButton targetRef={textRef} value={text} onChange={setText} className="mt-1 shrink-0 border" />
        </div>
      </EditorField>

      <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
        <EditorField label="Accessory" help="Optional element shown to the right of the section text.">
          <RadioGroup
            value={accessoryKind === 'other' ? 'other' : accessoryKind}
            onValueChange={(v) => setAccessoryKind(v as AccessoryKind)}
            className="flex flex-row flex-wrap gap-3"
          >
            {(
              [
                ['none', 'None'],
                ['button', 'Button'],
                ['image', 'Image']
              ] as const
            ).map(([value, label]) => (
              <div key={value} className="flex items-center gap-1.5">
                <RadioGroupItem value={value} id={`section-acc-${value}`} />
                <Label htmlFor={`section-acc-${value}`} className="text-xs capitalize">
                  {label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </EditorField>

        {accessoryKind === 'other' ? (
          <p className="text-[11px] leading-snug text-muted-foreground">
            This section has a {block.accessory?.type} accessory. That type is not editable in the visual builder yet.
            Use the View JSON drawer to edit it directly.
          </p>
        ) : null}

        {accessoryKind === 'button' && block.accessory?.type === 'button' ? (
          <ButtonAccessoryFields
            button={block.accessory}
            onChange={(next) => onChange({ ...block, accessory: next })}
          />
        ) : null}

        {accessoryKind === 'image' && block.accessory?.type === 'image' ? (
          <ImageAccessoryFields image={block.accessory} onChange={(next) => onChange({ ...block, accessory: next })} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Sub-form for editing a Button accessory: label, URL, value, style.
 * @param props - field props
 * @param props.button - the button accessory to edit
 * @param props.onChange - called with the updated button payload
 * @returns the rendered button accessory fields
 */
function ButtonAccessoryFields({ button, onChange }: { button: SlackButton; onChange: (next: SlackButton) => void }) {
  const label = button.text?.text ?? '';
  const url = button.url ?? '';
  const value = button.value ?? '';
  const style: ButtonStyle = button.style === 'primary' || button.style === 'danger' ? button.style : 'default';
  const labelRef = useRef<HTMLInputElement>(null);
  const setLabel = (next: string) => onChange({ ...button, text: { type: 'plain_text', text: next, emoji: true } });

  return (
    <div className="flex flex-col gap-3">
      <EditorField label="Label" htmlFor="section-acc-btn-label">
        <div className="flex items-center gap-1.5">
          <Input
            ref={labelRef}
            id="section-acc-btn-label"
            value={label}
            placeholder="e.g. Learn more"
            onChange={(e) => setLabel(e.target.value)}
          />
          <EmojiTextInsertButton targetRef={labelRef} value={label} onChange={setLabel} className="shrink-0 border" />
        </div>
      </EditorField>
      <EditorField
        label="Link URL"
        help="Optional. If set, clicking the button opens this link."
        htmlFor="section-acc-btn-url"
      >
        <Input
          id="section-acc-btn-url"
          type="url"
          value={url}
          placeholder="e.g. https://example.com"
          onChange={(e) => onChange({ ...button, url: e.target.value || undefined })}
        />
      </EditorField>
      <EditorField
        label="Value"
        help="Optional. Sent in the interaction payload when the button is clicked."
        htmlFor="section-acc-btn-value"
      >
        <Input
          id="section-acc-btn-value"
          value={value}
          placeholder="e.g. learn_more_clicked"
          onChange={(e) => onChange({ ...button, value: e.target.value || undefined })}
        />
      </EditorField>
      <EditorField label="Style" help="How the button looks in Slack.">
        <RadioGroup
          value={style}
          onValueChange={(v) => {
            const nextStyle: 'primary' | 'danger' | undefined = v === 'primary' || v === 'danger' ? v : undefined;
            onChange({ ...button, style: nextStyle });
          }}
          className="flex flex-row gap-3"
        >
          {(['default', 'primary', 'danger'] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <RadioGroupItem value={s} id={`section-acc-btn-style-${s}`} />
              <Label htmlFor={`section-acc-btn-style-${s}`} className="text-xs capitalize">
                {s}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>
    </div>
  );
}

/**
 * Sub-form for editing an Image accessory: image URL and alt text.
 * Slack-file image accessories are detected and shown as not editable.
 * @param props - field props
 * @param props.image - the image accessory to edit
 * @param props.onChange - called with the updated image payload
 * @returns the rendered image accessory fields
 */
function ImageAccessoryFields({ image, onChange }: { image: ImageElement; onChange: (next: ImageElement) => void }) {
  if (!('image_url' in image)) {
    return (
      <p className="text-[11px] leading-snug text-muted-foreground">
        This image accessory references a Slack file. Not editable in the visual builder.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <EditorField
        label="Image URL"
        help="A publicly accessible image URL (PNG, JPG, GIF)."
        htmlFor="section-acc-img-url"
      >
        <Input
          id="section-acc-img-url"
          type="url"
          value={image.image_url ?? ''}
          placeholder="e.g. https://example.com/thumb.png"
          onChange={(e) => onChange({ ...image, image_url: e.target.value })}
        />
      </EditorField>
      <EditorField
        label="Alt text"
        help="Describes the image for screen readers and when it fails to load."
        htmlFor="section-acc-img-alt"
      >
        <Input
          id="section-acc-img-alt"
          value={image.alt_text ?? ''}
          placeholder="e.g. Roadmap thumbnail"
          onChange={(e) => onChange({ ...image, alt_text: e.target.value })}
        />
      </EditorField>
    </div>
  );
}
