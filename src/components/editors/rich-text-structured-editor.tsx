import { Plus, Trash2 } from 'lucide-react';
import type {
  AnyRichTextBlockElement,
  AnyRichTextSectionElement,
  RichTextBlock,
  RichTextList,
  RichTextPreformatted,
  RichTextQuote,
  RichTextSection,
  RichTextSectionElementStyle,
  RichTextSectionLink,
  RichTextSectionText
} from 'slack-web-api-client';
import { cn } from '../../lib/cn';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { RadioGroup, RadioGroupItem } from '../../lib/ui/radio-group';
import { isSafeHref } from '../../lib/url-safety';
import { EmojiPickerButton } from '../emoji/emoji-picker-button';
import { EditorField } from './field';
import type { BlockEditorProps } from './types';

type BlockElementKind = AnyRichTextBlockElement['type'];
type InlineKind = 'text' | 'link' | 'emoji' | 'user' | 'channel' | 'broadcast' | 'usergroup';

type SectionLikeKind = 'rich_text_section' | 'rich_text_quote' | 'rich_text_preformatted';

const BLOCK_ELEMENT_LABEL: Record<BlockElementKind, string> = {
  rich_text_section: 'Section',
  rich_text_list: 'List',
  rich_text_quote: 'Quote',
  rich_text_preformatted: 'Preformatted'
};

const INLINE_LABEL: Record<InlineKind, string> = {
  text: 'Text',
  link: 'Link',
  emoji: 'Emoji',
  user: 'User',
  channel: 'Channel',
  broadcast: 'Broadcast',
  usergroup: 'User group'
};

const STYLE_KEYS = ['bold', 'italic', 'strike', 'code'] as const;
type StyleKey = (typeof STYLE_KEYS)[number];

/**
 * Structured fallback editor for rich_text blocks. Used when the WYSIWYG
 * (TipTap) editor would lose data on a round trip (mentions, broadcasts,
 * emoji, list indent, etc.). Renders the top-level elements as a list of
 * cards with a type switcher; each section-like element exposes its
 * inline elements as nested cards with the fields appropriate to that
 * type. Less common inline types (date, color, team) are not authorable
 * here; they're preserved on the block payload as-is.
 * @param props - editor props
 * @param props.block - the rich_text block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered structured rich text editor form
 */
export function RichTextStructuredEditor({ block, onChange }: BlockEditorProps<RichTextBlock>) {
  const elements = block.elements ?? [];

  const replaceElements = (next: AnyRichTextBlockElement[]) => {
    onChange({ ...block, elements: next });
  };

  const updateAt = (idx: number, next: AnyRichTextBlockElement) => {
    replaceElements(elements.map((el, i) => (i === idx ? next : el)));
  };

  const removeAt = (idx: number) => {
    replaceElements(elements.filter((_, i) => i !== idx));
  };

  const addElement = (kind: BlockElementKind) => {
    replaceElements([...elements, defaultBlockElement(kind)]);
  };

  return (
    <div className="flex flex-col gap-3">
      {elements.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          No elements yet. Add a section, list, quote, or preformatted block to start.
        </p>
      ) : null}
      {elements.map((el, idx) => (
        <BlockElementCard
          key={`${el.type}-${idx}`}
          index={idx}
          element={el}
          onChange={(next) => updateAt(idx, next)}
          onRemove={() => removeAt(idx)}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLOCK_ELEMENT_LABEL) as BlockElementKind[]).map((kind) => (
          <Button key={kind} type="button" size="sm" onClick={() => addElement(kind)}>
            <Plus className="h-3.5 w-3.5" />
            Add {BLOCK_ELEMENT_LABEL[kind]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Card UI for one top-level rich_text block element with a type switcher.
 * @param props - card props
 * @param props.index - position of the element within the rich_text block
 * @param props.element - the block element being edited
 * @param props.onChange - called with the updated element
 * @param props.onRemove - called when the user removes the element
 * @returns the rendered block element card
 */
function BlockElementCard({
  index,
  element,
  onChange,
  onRemove
}: {
  index: number;
  element: AnyRichTextBlockElement;
  onChange: (next: AnyRichTextBlockElement) => void;
  onRemove: () => void;
}) {
  const setKind = (next: BlockElementKind) => {
    if (next === element.type) {
      return;
    }
    onChange(reshapeBlockElement(element, next));
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {BLOCK_ELEMENT_LABEL[element.type]} {index + 1}
        </span>
        <button
          type="button"
          aria-label="Remove element"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <EditorField label="Type">
        <RadioGroup
          value={element.type}
          onValueChange={(v) => setKind(v as BlockElementKind)}
          className="flex flex-row flex-wrap gap-3"
        >
          {(Object.keys(BLOCK_ELEMENT_LABEL) as BlockElementKind[]).map((kind) => (
            <div key={kind} className="flex items-center gap-1.5">
              <RadioGroupItem value={kind} id={`rt-${index}-kind-${kind}`} />
              <Label htmlFor={`rt-${index}-kind-${kind}`} className="text-xs">
                {BLOCK_ELEMENT_LABEL[kind]}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>
      {element.type === 'rich_text_list' ? (
        <ListBody parentIndex={index} element={element} onChange={(next) => onChange(next)} />
      ) : (
        <SectionLikeBody parentIndex={index} element={element} onChange={(next) => onChange(next)} />
      )}
    </div>
  );
}

/**
 * Body editor for section, quote, and preformatted elements (their inlines).
 * @param props - body props
 * @param props.parentIndex - index of the parent element, used to build ids
 * @param props.element - the section-like element being edited
 * @param props.onChange - called with the updated element
 * @returns the rendered inline elements editor
 */
function SectionLikeBody({
  parentIndex,
  element,
  onChange
}: {
  parentIndex: number;
  element: RichTextSection | RichTextQuote | RichTextPreformatted;
  onChange: (next: RichTextSection | RichTextQuote | RichTextPreformatted) => void;
}) {
  return (
    <InlineElementsEditor
      idPrefix={`rt-${parentIndex}-section`}
      elements={element.elements ?? []}
      onChange={(next) => onChange({ ...element, elements: next })}
    />
  );
}

/**
 * Body editor for rich_text_list elements: style, indent, and items.
 * @param props - body props
 * @param props.parentIndex - index of the parent element, used to build ids
 * @param props.element - the list element being edited
 * @param props.onChange - called with the updated element
 * @returns the rendered list editor
 */
function ListBody({
  parentIndex,
  element,
  onChange
}: {
  parentIndex: number;
  element: RichTextList;
  onChange: (next: RichTextList) => void;
}) {
  const items = element.elements ?? [];

  const updateItem = (idx: number, next: RichTextSection) => {
    onChange({
      ...element,
      elements: items.map((it, i) => (i === idx ? next : it))
    });
  };

  const removeItem = (idx: number) => {
    onChange({
      ...element,
      elements: items.filter((_, i) => i !== idx)
    });
  };

  const addItem = () => {
    onChange({
      ...element,
      elements: [...items, defaultSection()]
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <EditorField label="Style">
          <RadioGroup
            value={element.style ?? 'bullet'}
            onValueChange={(v) =>
              onChange({
                ...element,
                style: v === 'ordered' ? 'ordered' : 'bullet'
              })
            }
            className="flex flex-row gap-3"
          >
            {(['bullet', 'ordered'] as const).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <RadioGroupItem value={s} id={`rt-${parentIndex}-list-${s}`} />
                <Label htmlFor={`rt-${parentIndex}-list-${s}`} className="text-xs capitalize">
                  {s}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </EditorField>
        <EditorField label="Indent" htmlFor={`rt-${parentIndex}-indent`}>
          <Input
            id={`rt-${parentIndex}-indent`}
            type="number"
            min={0}
            max={8}
            value={element.indent ?? 0}
            className="w-20"
            onChange={(e) => {
              const n = Number(e.target.value);
              onChange({
                ...element,
                indent: Number.isFinite(n) ? Math.max(0, n) : 0
              });
            }}
          />
        </EditorField>
      </div>
      {items.map((item, idx) => (
        <div key={`item-${idx}`} className="flex flex-col gap-2 rounded border bg-background p-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Item {idx + 1}</span>
            <button
              type="button"
              aria-label="Remove item"
              onClick={() => removeItem(idx)}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <InlineElementsEditor
            idPrefix={`rt-${parentIndex}-item-${idx}`}
            elements={item.elements ?? []}
            onChange={(next) => updateItem(idx, { ...item, elements: next })}
          />
        </div>
      ))}
      <Button type="button" size="sm" onClick={addItem} className="self-start">
        <Plus className="h-3.5 w-3.5" />
        Add item
      </Button>
    </div>
  );
}

/**
 * Editor for a flat list of inline rich_text section elements.
 * @param props - editor props
 * @param props.idPrefix - prefix used to build child input ids
 * @param props.elements - the inline elements to edit
 * @param props.onChange - called with the updated inline list
 * @returns the rendered inline elements editor
 */
function InlineElementsEditor({
  idPrefix,
  elements,
  onChange
}: {
  idPrefix: string;
  elements: AnyRichTextSectionElement[];
  onChange: (next: AnyRichTextSectionElement[]) => void;
}) {
  const updateAt = (idx: number, next: AnyRichTextSectionElement) => {
    onChange(elements.map((el, i) => (i === idx ? next : el)));
  };
  const removeAt = (idx: number) => {
    onChange(elements.filter((_, i) => i !== idx));
  };
  const addInline = (kind: InlineKind) => {
    onChange([...elements, defaultInline(kind)]);
  };

  return (
    <div className="flex flex-col gap-2">
      {elements.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          No inline elements yet. Add a text run, link, emoji, or mention.
        </p>
      ) : null}
      {elements.map((el, idx) => (
        <InlineElementCard
          key={`${el.type}-${idx}`}
          idPrefix={`${idPrefix}-inline-${idx}`}
          element={el}
          onChange={(next) => updateAt(idx, next)}
          onRemove={() => removeAt(idx)}
        />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(INLINE_LABEL) as InlineKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => addInline(kind)}
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
            {INLINE_LABEL[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Card UI for one inline element with the appropriate fields for its type.
 * @param props - card props
 * @param props.idPrefix - prefix used to build child input ids
 * @param props.element - the inline element being edited
 * @param props.onChange - called with the updated element
 * @param props.onRemove - called when the user removes the element
 * @returns the rendered inline element card
 */
function InlineElementCard({
  idPrefix,
  element,
  onChange,
  onRemove
}: {
  idPrefix: string;
  element: AnyRichTextSectionElement;
  onChange: (next: AnyRichTextSectionElement) => void;
  onRemove: () => void;
}) {
  const editableKind = inlineKindFor(element);

  return (
    <div className="flex flex-col gap-2 rounded border bg-background p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">
          {editableKind ? INLINE_LABEL[editableKind] : element.type}
        </span>
        <button
          type="button"
          aria-label="Remove inline element"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {editableKind === null ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {element.type} elements are preserved on the block but not editable in the visual builder. Use the View JSON
          drawer.
        </p>
      ) : (
        <InlineFields idPrefix={idPrefix} element={element} kind={editableKind} onChange={onChange} />
      )}
    </div>
  );
}

/**
 * Renders the field set appropriate to the inline element's kind.
 * @param props - field props
 * @param props.idPrefix - prefix used to build input ids
 * @param props.element - the inline element being edited
 * @param props.kind - the editable kind dispatching which fields to show
 * @param props.onChange - called with the updated element
 * @returns the rendered fields for the given kind
 */
function InlineFields({
  idPrefix,
  element,
  kind,
  onChange
}: {
  idPrefix: string;
  element: AnyRichTextSectionElement;
  kind: InlineKind;
  onChange: (next: AnyRichTextSectionElement) => void;
}) {
  if (kind === 'text') {
    const text = element as RichTextSectionText;
    return (
      <div className="flex flex-col gap-2">
        <EditorField label="Text" htmlFor={`${idPrefix}-text`}>
          <Input
            id={`${idPrefix}-text`}
            value={text.text ?? ''}
            onChange={(e) => onChange({ ...text, text: e.target.value })}
          />
        </EditorField>
        <StyleToggles idPrefix={idPrefix} style={text.style} onChange={(s) => onChange({ ...text, style: s })} />
      </div>
    );
  }

  if (kind === 'link') {
    const link = element as RichTextSectionLink;
    const urlValue = link.url ?? '';
    const urlIsUnsafe = urlValue.length > 0 && !isSafeHref(urlValue);
    return (
      <div className="flex flex-col gap-2">
        <EditorField label="URL" htmlFor={`${idPrefix}-url`}>
          <Input
            id={`${idPrefix}-url`}
            type="url"
            value={urlValue}
            placeholder="e.g. https://slack.com"
            onChange={(e) => onChange({ ...link, url: e.target.value })}
            aria-invalid={urlIsUnsafe || undefined}
          />
          {urlIsUnsafe && (
            <p className="mt-1 text-[11px] text-destructive">
              Only http(s), mailto, tel, sms, and xmpp links are allowed. This URL will be stripped before send and
              preview.
            </p>
          )}
        </EditorField>
        <EditorField
          label="Display text"
          help="Optional. Falls back to the URL when empty."
          htmlFor={`${idPrefix}-link-text`}
        >
          <Input
            id={`${idPrefix}-link-text`}
            value={link.text ?? ''}
            onChange={(e) => onChange({ ...link, text: e.target.value || undefined })}
          />
        </EditorField>
        <StyleToggles
          idPrefix={idPrefix}
          style={link.style as RichTextSectionElementStyle | undefined}
          onChange={(s) =>
            onChange({
              ...link,
              style: s as RichTextSectionLink['style']
            })
          }
        />
      </div>
    );
  }

  if (kind === 'emoji') {
    const emoji = element as { type: 'emoji'; name?: string; skin_tone?: number };
    return (
      <EditorField
        label="Name"
        help="Pick from the emoji list, or type a shortcode (without colons)."
        htmlFor={`${idPrefix}-emoji`}
      >
        <div className="flex items-center gap-1.5">
          <Input
            id={`${idPrefix}-emoji`}
            value={emoji.name ?? ''}
            placeholder="e.g. wave"
            onChange={(e) => onChange({ ...emoji, name: e.target.value })}
          />
          <EmojiPickerButton
            align="end"
            label="Pick emoji"
            className="shrink-0 border"
            // Clear any stale `unicode` from the prior emoji so it can't
            // mismatch the newly-picked name; Slack recomputes the glyph from
            // `name` (+ `skin_tone`).
            onSelect={(sel) =>
              onChange({ ...emoji, name: sel.name, skin_tone: sel.skinTone ?? undefined, unicode: undefined })
            }
          />
        </div>
      </EditorField>
    );
  }

  if (kind === 'user') {
    const user = element as { type: 'user'; user_id?: string };
    return (
      <EditorField label="User ID" help="The Slack user ID, e.g. U01ABCDEF" htmlFor={`${idPrefix}-user`}>
        <Input
          id={`${idPrefix}-user`}
          value={user.user_id ?? ''}
          placeholder="e.g. U01ABCDEF"
          onChange={(e) => onChange({ ...user, user_id: e.target.value })}
        />
      </EditorField>
    );
  }

  if (kind === 'channel') {
    const channel = element as { type: 'channel'; channel_id?: string };
    return (
      <EditorField label="Channel ID" help="The Slack channel ID, e.g. C01ABCDEF" htmlFor={`${idPrefix}-channel`}>
        <Input
          id={`${idPrefix}-channel`}
          value={channel.channel_id ?? ''}
          placeholder="e.g. C01ABCDEF"
          onChange={(e) => onChange({ ...channel, channel_id: e.target.value })}
        />
      </EditorField>
    );
  }

  if (kind === 'broadcast') {
    const broadcast = element as {
      type: 'broadcast';
      range?: 'here' | 'channel' | 'everyone';
    };
    return (
      <EditorField label="Range">
        <RadioGroup
          value={broadcast.range ?? 'here'}
          onValueChange={(v) =>
            onChange({
              ...broadcast,
              range: v as 'here' | 'channel' | 'everyone'
            })
          }
          className="flex flex-row gap-3"
        >
          {(['here', 'channel', 'everyone'] as const).map((r) => (
            <div key={r} className="flex items-center gap-1.5">
              <RadioGroupItem value={r} id={`${idPrefix}-bcast-${r}`} />
              <Label htmlFor={`${idPrefix}-bcast-${r}`} className="text-xs capitalize">
                @{r}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </EditorField>
    );
  }

  // usergroup
  const ug = element as { type: 'usergroup'; usergroup_id?: string };
  return (
    <EditorField
      label="User group ID"
      help="The Slack user group (subteam) ID, e.g. S01ABCDEF"
      htmlFor={`${idPrefix}-ug`}
    >
      <Input
        id={`${idPrefix}-ug`}
        value={ug.usergroup_id ?? ''}
        placeholder="e.g. S01ABCDEF"
        onChange={(e) => onChange({ ...ug, usergroup_id: e.target.value })}
      />
    </EditorField>
  );
}

/**
 * Toggle row for bold/italic/strike/code style flags on an inline element.
 * @param props - toggle props
 * @param props.idPrefix - prefix used to build button ids
 * @param props.style - the current style flags, if any
 * @param props.onChange - called with the updated style or undefined when empty
 * @returns the rendered style toggle row
 */
function StyleToggles({
  idPrefix,
  style,
  onChange
}: {
  idPrefix: string;
  style: RichTextSectionElementStyle | undefined;
  onChange: (next: RichTextSectionElementStyle | undefined) => void;
}) {
  const current = style ?? {};
  const toggle = (key: StyleKey) => {
    const next: Record<string, boolean> = { ...current };
    if (next[key]) {
      delete next[key];
    } else {
      next[key] = true;
    }
    onChange(Object.keys(next).length > 0 ? (next as RichTextSectionElementStyle) : undefined);
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {STYLE_KEYS.map((key) => {
        const active = Boolean((current as Record<string, boolean>)[key]);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={cn(
              'cursor-pointer rounded border px-2 py-0.5 text-[11px] capitalize transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            aria-pressed={active}
            id={`${idPrefix}-style-${key}`}
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Returns the editable inline kind for an element, or null if not authorable.
 * @param el - the inline element to classify
 * @returns the matching InlineKind, or null when the type is not editable
 */
function inlineKindFor(el: AnyRichTextSectionElement): InlineKind | null {
  switch (el.type) {
    case 'text':
      return 'text';
    case 'link':
      return 'link';
    case 'emoji':
      return 'emoji';
    case 'user':
      return 'user';
    case 'channel':
      return 'channel';
    case 'broadcast':
      return 'broadcast';
    case 'usergroup':
      return 'usergroup';
    default:
      return null;
  }
}

/**
 * Builds a fresh block element of the requested kind with sample content.
 * @param kind - the kind of block element to create
 * @returns a freshly constructed block element
 */
function defaultBlockElement(kind: BlockElementKind): AnyRichTextBlockElement {
  switch (kind) {
    case 'rich_text_section':
      return defaultSection();
    case 'rich_text_list':
      return {
        type: 'rich_text_list',
        style: 'bullet',
        elements: [defaultSection('First item')]
      };
    case 'rich_text_quote':
      return {
        type: 'rich_text_quote',
        elements: [{ type: 'text', text: 'Quoted text' }]
      };
    case 'rich_text_preformatted':
      return {
        type: 'rich_text_preformatted',
        elements: [{ type: 'text', text: 'Preformatted text' }]
      };
  }
}

/**
 * Builds a rich_text_section containing a single text run.
 * @param text - the initial text run content
 * @returns a freshly constructed rich_text_section
 */
function defaultSection(text = 'Text'): RichTextSection {
  return {
    type: 'rich_text_section',
    elements: [{ type: 'text', text }]
  };
}

/**
 * Builds a fresh inline element of the requested kind with sample content.
 * @param kind - the kind of inline element to create
 * @returns a freshly constructed inline element
 */
function defaultInline(kind: InlineKind): AnyRichTextSectionElement {
  switch (kind) {
    case 'text':
      return { type: 'text', text: 'text' };
    case 'link':
      return { type: 'link', url: 'https://slack.com', text: 'link' };
    case 'emoji':
      return { type: 'emoji', name: 'wave' };
    case 'user':
      return { type: 'user', user_id: 'U01ABCDEF' };
    case 'channel':
      return { type: 'channel', channel_id: 'C01ABCDEF' };
    case 'broadcast':
      return { type: 'broadcast', range: 'here' };
    case 'usergroup':
      return { type: 'usergroup', usergroup_id: 'S01ABCDEF' };
  }
}

/**
 * Re-types a block element while preserving inline content where possible.
 * @param el - the existing block element
 * @param to - the target block element kind
 * @returns the reshaped element
 */
function reshapeBlockElement(el: AnyRichTextBlockElement, to: BlockElementKind): AnyRichTextBlockElement {
  if (el.type === 'rich_text_list' && to !== 'rich_text_list') {
    // collapse list items into a single section's worth of inlines
    const inlines = (el.elements ?? []).flatMap((item) => item.elements ?? []);
    return wrapInlines(to as SectionLikeKind, inlines);
  }
  if (el.type !== 'rich_text_list' && to === 'rich_text_list') {
    // wrap existing inlines as a single list item
    return {
      type: 'rich_text_list',
      style: 'bullet',
      elements: [{ type: 'rich_text_section', elements: el.elements ?? [] }]
    };
  }
  if (el.type !== 'rich_text_list' && to !== 'rich_text_list') {
    return wrapInlines(to as SectionLikeKind, el.elements ?? []);
  }
  return el;
}

/**
 * Wraps a set of inline elements in the chosen section-like container.
 * @param kind - the section-like kind to construct
 * @param inlines - the inline elements to wrap
 * @returns the wrapped section-like element
 */
function wrapInlines(
  kind: SectionLikeKind,
  inlines: AnyRichTextSectionElement[]
): RichTextSection | RichTextQuote | RichTextPreformatted {
  return { type: kind, elements: inlines } as RichTextSection | RichTextQuote | RichTextPreformatted;
}
