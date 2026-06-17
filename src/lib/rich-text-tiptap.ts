import type {
  AnyRichTextBlockElement,
  AnyRichTextSectionElement,
  RichTextBlock,
  RichTextSectionElementStyleWithCode,
  RichTextSectionLink
} from 'slack-web-api-client';
import { sanitizeHref } from './url-safety';

type RichStyle = RichTextSectionElementStyleWithCode;

/**
 * Minimal ProseMirror node shape we read/write. Mirrors the JSON format
 * TipTap emits via `editor.getJSON()` and accepts via `setContent`.
 * We avoid pulling in `prosemirror-model` types so this file stays
 * dependency-free for tests.
 */
export interface PMNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PMNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

const SUPPORTED_BLOCK_KINDS = new Set([
  'rich_text_section',
  'rich_text_list',
  'rich_text_quote',
  'rich_text_preformatted'
]);

const SUPPORTED_INLINE_KINDS = new Set(['text', 'link', 'emoji']);

const SUPPORTED_TEXT_STYLE_KEYS = new Set(['bold', 'italic', 'strike', 'underline', 'code']);

/**
 * Slack's documented maximum value for `indent` on a rich_text_list.
 * Deeper nesting is flattened to this depth on export.
 */
const MAX_LIST_INDENT = 8;

/**
 * Reasons a Slack rich_text payload can't round-trip cleanly through the
 * TipTap WYSIWYG (paragraphs, lists, blockquote, code block, emoji, plus
 * bold/italic/strike/underline/code marks and links). Anything else (mentions,
 * broadcasts, list indent, etc.) ends up in this list so the UI
 * can offer the structured editor instead.
 */
export interface LossyReason {
  /** Short label suitable for a UI badge or list item. */
  label: string;
  /** Path within the rich_text payload, for diagnostics. */
  where: string;
}

/**
 * Inspects a rich_text block and reports anything the WYSIWYG converter
 * would drop on a round trip.
 * @param block - the rich_text block to inspect
 * @returns array of reasons; an empty array means safe to round-trip
 */
export function detectLossy(block: RichTextBlock): LossyReason[] {
  const out: LossyReason[] = [];
  const blocks = block.elements ?? [];
  blocks.forEach((el, blockIdx) => {
    const where = `elements[${blockIdx}]`;
    if (!SUPPORTED_BLOCK_KINDS.has(el.type)) {
      out.push({ label: `Unsupported element: ${el.type}`, where });
      return;
    }
    if (el.type === 'rich_text_list') {
      if ((el.border ?? 0) > 0) {
        out.push({ label: 'List border', where });
      }
      el.elements?.forEach((item, itemIdx) => {
        scanInlines(item.elements ?? [], `${where}.elements[${itemIdx}]`, out);
      });
      return;
    }
    if ('border' in el && (el.border ?? 0) > 0) {
      out.push({ label: 'Quote/preformatted border', where });
    }
    scanInlines(el.elements ?? [], where, out);
  });
  return out;
}

/**
 * Walks inline elements and pushes a LossyReason for each unsupported feature.
 * @param inlines - inline elements to scan
 * @param where - dotted path describing the location, used in diagnostics
 * @param out - accumulator the helper appends LossyReason entries to
 */
function scanInlines(inlines: AnyRichTextSectionElement[], where: string, out: LossyReason[]) {
  inlines.forEach((inline, i) => {
    const sub = `${where}.elements[${i}]`;
    if (!SUPPORTED_INLINE_KINDS.has(inline.type)) {
      out.push({ label: `Inline: ${inline.type}`, where: sub });
      return;
    }
    if (inline.type === 'text') {
      const style = inline.style;
      if (style) {
        for (const k of Object.keys(style)) {
          if (!SUPPORTED_TEXT_STYLE_KEYS.has(k)) {
            out.push({ label: `Text style: ${k}`, where: sub });
          }
        }
      }
    }
  });
}

/** The Slack emoji element shape we read on import. */
interface SlackEmojiElement {
  type: 'emoji';
  name?: string;
  unicode?: string;
  skin_tone?: number;
}

/**
 * Resolves the render-only attributes (`src`, `unicode`) of a Slack emoji
 * element when importing into the WYSIWYG. Lets the editor inject a custom
 * emoji image (from `customEmojis`) and a glyph codepoint (from
 * `emoji-datasource`) without this module depending on either. Optional: when
 * omitted, emoji carry only what the payload already specifies.
 * @param el - the Slack emoji element
 * @returns the PM emoji node attrs
 */
export type EmojiImportResolver = (el: SlackEmojiElement) => {
  name: string;
  src: string | null;
  unicode: string | null;
  skinTone: number | null;
};

const defaultEmojiResolver: EmojiImportResolver = (el) => ({
  name: el.name ?? '',
  src: null,
  unicode: el.unicode ?? null,
  skinTone: el.skin_tone ?? null
});

/**
 * Converts a Slack rich_text block to a TipTap-compatible ProseMirror
 * `doc` node. Anything not in {@link detectLossy}'s supported set is
 * dropped (callers should pre-flight with `detectLossy`).
 * @param block - the rich_text block to convert
 * @param resolveEmoji - optional resolver for emoji `src` / `unicode`
 * @returns a ProseMirror `doc` node
 */
export function richTextToProseMirror(
  block: RichTextBlock,
  resolveEmoji: EmojiImportResolver = defaultEmojiResolver
): PMNode {
  const content: PMNode[] = [];
  // Track the most-recent list at each indent level so we can append
  // sibling rich_text_list elements with the same indent and nest deeper
  // ones inside the parent's last listItem.
  const listsByIndent = new Map<number, PMNode>();

  for (const el of block.elements ?? []) {
    if (el.type === 'rich_text_list') {
      appendRichTextList(el, content, listsByIndent, resolveEmoji);
      continue;
    }
    listsByIndent.clear();
    const node = blockElementToPM(el, resolveEmoji);
    if (node) {
      content.push(node);
    }
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }]
  };
}

/**
 * Appends a Slack rich_text_list as a ProseMirror list, nesting deeper
 * indents inside the previous level's last list item.
 * @param el - the Slack rich_text_list element
 * @param topLevel - the running array of top-level ProseMirror nodes
 * @param listsByIndent - map tracking the open list at each indent level
 */
function appendRichTextList(
  el: Extract<AnyRichTextBlockElement, { type: 'rich_text_list' }>,
  topLevel: PMNode[],
  listsByIndent: Map<number, PMNode>,
  resolveEmoji: EmojiImportResolver
) {
  const indent = el.indent ?? 0;
  const listType = el.style === 'ordered' ? 'orderedList' : 'bulletList';
  const items: PMNode[] = (el.elements ?? []).map((section) => ({
    type: 'listItem',
    content: [{ type: 'paragraph', content: inlinesToPM(section.elements ?? [], resolveEmoji) }]
  }));

  // Drop any deeper-indent lists from the running map; we've left them.
  for (const k of Array.from(listsByIndent.keys())) {
    if (k > indent) {
      listsByIndent.delete(k);
    }
  }

  const existing = listsByIndent.get(indent);
  if (existing && existing.type === listType) {
    existing.content = [...(existing.content ?? []), ...items];
    return;
  }

  const list: PMNode = { type: listType, content: items };
  listsByIndent.set(indent, list);

  if (indent === 0) {
    topLevel.push(list);
    return;
  }
  const parent = listsByIndent.get(indent - 1);
  if (!parent?.content || parent.content.length === 0) {
    // Skipped indent levels (uncommon). Fall back to top-level.
    topLevel.push(list);
    return;
  }
  const parentLastItem = parent.content[parent.content.length - 1];
  parentLastItem.content = [...(parentLastItem.content ?? []), list];
}

/**
 * Converts a single Slack rich_text block element to a ProseMirror node.
 * Lists are handled separately via {@link appendRichTextList}.
 * @param el - the Slack rich_text block element
 * @returns the corresponding ProseMirror node, or null for list elements
 */
function blockElementToPM(el: AnyRichTextBlockElement, resolveEmoji: EmojiImportResolver): PMNode | null {
  if (el.type === 'rich_text_section') {
    return {
      type: 'paragraph',
      content: inlinesToPM(el.elements ?? [], resolveEmoji)
    };
  }
  if (el.type === 'rich_text_quote') {
    return {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: inlinesToPM(el.elements ?? [], resolveEmoji)
        }
      ]
    };
  }
  if (el.type === 'rich_text_preformatted') {
    const text = (el.elements ?? []).map((i) => (i.type === 'text' ? i.text : '')).join('');
    const node: PMNode = { type: 'codeBlock' };
    if (text) {
      node.content = [{ type: 'text', text }];
    }
    return node;
  }
  // rich_text_list is handled separately by appendRichTextList so we can
  // re-nest indented lists into ProseMirror's nested-list shape.
  return null;
}

/**
 * Pushes a Slack text run onto a ProseMirror inline array, converting any
 * embedded newlines into `hardBreak` nodes so they render as soft line
 * breaks in the editor (and round-trip back to `\n` on export). A run of
 * N consecutive newlines becomes N hardBreaks, so blank lines (`\n\n`)
 * are preserved. Without this, a `\n` inside a Slack text element would
 * become a literal newline character in a ProseMirror text node, which
 * the browser collapses to a space.
 * @param out - the inline array to append to
 * @param text - the Slack text run, possibly containing `\n`
 * @param marks - marks to apply to each text segment
 */
function pushTextWithHardBreaks(
  out: PMNode[],
  text: string,
  marks: { type: string; attrs?: Record<string, unknown> }[]
) {
  const segments = text.split('\n');
  segments.forEach((segment, i) => {
    if (i > 0) {
      out.push({ type: 'hardBreak' });
    }
    if (segment) {
      out.push({ type: 'text', text: segment, marks });
    }
  });
}

/**
 * Converts Slack inline section elements (text, link) to ProseMirror text
 * nodes with the appropriate marks. Unsupported types are silently dropped.
 * @param inlines - inline elements from a section, quote, or list item
 * @param resolveEmoji - resolver for emoji `src` / `unicode`
 * @returns the corresponding ProseMirror text nodes
 */
function inlinesToPM(inlines: AnyRichTextSectionElement[], resolveEmoji: EmojiImportResolver): PMNode[] {
  const out: PMNode[] = [];
  for (const inline of inlines) {
    if (inline.type === 'text') {
      if (!inline.text) {
        continue;
      }
      pushTextWithHardBreaks(out, inline.text, styleToMarks(inline.style));
    } else if (inline.type === 'emoji') {
      const attrs = resolveEmoji(inline as SlackEmojiElement);
      if (!attrs.name) {
        continue;
      }
      out.push({ type: 'emoji', attrs });
    } else if (inline.type === 'link') {
      const link = inline as RichTextSectionLink;
      const text = link.text || link.url || '';
      if (!text) {
        continue;
      }
      out.push({
        type: 'text',
        text,
        marks: [...styleToMarks(link.style as RichStyle | undefined), { type: 'link', attrs: { href: link.url } }]
      });
    }
    // unsupported inlines are silently dropped (caller pre-flighted)
  }
  return out;
}

/**
 * Converts Slack rich_text style flags to ProseMirror marks.
 * @param style - the Slack style flags, if any
 * @returns the corresponding ProseMirror marks (may be empty)
 */
function styleToMarks(style: RichStyle | undefined): { type: string; attrs?: Record<string, unknown> }[] {
  if (!style) {
    return [];
  }
  const marks: { type: string }[] = [];
  if (style.bold) {
    marks.push({ type: 'bold' });
  }
  if (style.italic) {
    marks.push({ type: 'italic' });
  }
  if (style.strike) {
    marks.push({ type: 'strike' });
  }
  if (style.underline) {
    marks.push({ type: 'underline' });
  }
  if (style.code) {
    marks.push({ type: 'code' });
  }
  return marks;
}

/**
 * Converts a TipTap `doc` node back to a Slack rich_text block.
 * Inverse of {@link richTextToProseMirror}.
 * @param doc - the ProseMirror `doc` node from `editor.getJSON()`
 * @returns a fresh rich_text block
 */
export function proseMirrorToRichText(doc: PMNode): RichTextBlock {
  const elements: AnyRichTextBlockElement[] = [];
  for (const node of doc.content ?? []) {
    pushBlockElements(node, 0, elements);
  }
  return { type: 'rich_text', elements };
}

/**
 * Translates one ProseMirror block-level node into Slack rich_text elements
 * and pushes them onto the output array.
 * @param node - the ProseMirror node to translate
 * @param indent - current list indent depth, used by nested lists
 * @param out - accumulator the helper appends Slack elements to
 */
function pushBlockElements(node: PMNode, indent: number, out: AnyRichTextBlockElement[]) {
  if (node.type === 'paragraph') {
    out.push({
      type: 'rich_text_section',
      elements: proseMirrorInlinesToRichTextElements(node.content ?? [])
    });
    return;
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    flattenList(node, indent, out);
    return;
  }
  if (node.type === 'blockquote') {
    const para = node.content?.find((n) => n.type === 'paragraph') ?? node.content?.[0];
    out.push({
      type: 'rich_text_quote',
      elements: proseMirrorInlinesToRichTextElements(para?.content ?? [])
    });
    return;
  }
  if (node.type === 'codeBlock') {
    const text = (node.content ?? []).map((n) => n.text ?? '').join('');
    out.push({
      type: 'rich_text_preformatted',
      elements: [{ type: 'text', text }]
    });
  }
}

/**
 * Flattens a (possibly nested) ProseMirror list into sibling Slack
 * rich_text_list elements with increasing `indent` values.
 * @param listNode - the ProseMirror bullet or ordered list node
 * @param indent - current indent depth (0 at the top level)
 * @param out - accumulator the helper appends Slack elements to
 */
function flattenList(listNode: PMNode, indent: number, out: AnyRichTextBlockElement[]) {
  const style = listNode.type === 'orderedList' ? 'ordered' : 'bullet';
  // Slack rich_text caps `indent` at 8. Clamp here so we never emit a
  // payload Slack will reject; deeper nesting will visually flatten in
  // the preview but text content is preserved.
  const clampedIndent = Math.min(indent, MAX_LIST_INDENT);
  // Buffer items at this indent into one rich_text_list. When an item
  // has nested lists, flush the buffer, then recurse into the nested
  // list at indent + 1, so Slack sees flat sibling lists with deeper
  // `indent` values.
  let buffered: {
    type: 'rich_text_section';
    elements: AnyRichTextSectionElement[];
  }[] = [];
  const flush = () => {
    if (buffered.length === 0) {
      return;
    }
    const list: AnyRichTextBlockElement = {
      type: 'rich_text_list',
      style,
      elements: buffered
    };
    if (clampedIndent > 0) {
      (list as { indent?: number }).indent = clampedIndent;
    }
    out.push(list);
    buffered = [];
  };

  for (const item of listNode.content ?? []) {
    if (item.type !== 'listItem') {
      continue;
    }
    let para: PMNode | undefined;
    const nested: PMNode[] = [];
    for (const child of item.content ?? []) {
      if (child.type === 'paragraph' && !para) {
        para = child;
      } else if (child.type === 'bulletList' || child.type === 'orderedList') {
        nested.push(child);
      }
    }
    buffered.push({
      type: 'rich_text_section',
      elements: proseMirrorInlinesToRichTextElements(para?.content ?? [])
    });
    if (nested.length > 0) {
      flush();
      for (const sub of nested) {
        flattenList(sub, indent + 1, out);
      }
    }
  }
  flush();
}

/**
 * Converts ProseMirror inline text nodes (with marks) back to Slack
 * inline elements, merging adjacent runs that share the same style.
 * @param nodes - ProseMirror text nodes from a paragraph or list item
 * @returns the corresponding Slack inline elements
 */
function proseMirrorInlinesToRichTextElements(nodes: PMNode[]): AnyRichTextSectionElement[] {
  const out: AnyRichTextSectionElement[] = [];
  for (const node of nodes) {
    if (node.type === 'emoji') {
      const name = String(node.attrs?.name ?? '');
      if (!name) {
        continue;
      }
      // Export keeps only Slack's fields: `name` (+ `skin_tone`). The
      // render-only `src` / `unicode` attrs are intentionally dropped.
      const emoji: AnyRichTextSectionElement = { type: 'emoji', name };
      const skinTone = node.attrs?.skinTone;
      if (typeof skinTone === 'number' && skinTone >= 2 && skinTone <= 6) {
        (emoji as { skin_tone?: number }).skin_tone = skinTone;
      }
      out.push(emoji);
      continue;
    }
    if (node.type === 'hardBreak') {
      // A soft line break (Shift+Enter) becomes a newline in the Slack
      // text stream. mergeAdjacentTextRuns folds this into neighbouring
      // unstyled runs, so "a" + <br> + "b" collapses to one "a\nb" run.
      out.push({ type: 'text', text: '\n' });
      continue;
    }
    if (node.type !== 'text' || !node.text) {
      continue;
    }
    const linkMark = node.marks?.find((m) => m.type === 'link');
    const style = marksToStyle(node.marks ?? []);
    if (linkMark) {
      // TipTap's setLink/toggleLink already gate on isAllowedUri, but
      // a link mark can also enter the editor via setContent() (used
      // when seeding from a payload). Sanitize once more here so a
      // crafted Slack rich_text payload that already contains an unsafe
      // href cannot round-trip back out unchanged.
      const url = sanitizeHref(String(linkMark.attrs?.href ?? ''));
      const link: RichTextSectionLink = {
        type: 'link',
        url,
        text: node.text
      };
      if (Object.keys(style).length > 0) {
        link.style = style as RichTextSectionLink['style'];
      }
      out.push(link);
    } else {
      const text: AnyRichTextSectionElement = {
        type: 'text',
        text: node.text
      };
      if (Object.keys(style).length > 0) {
        (text as { style?: RichStyle }).style = style;
      }
      out.push(text);
    }
  }
  return mergeAdjacentTextRuns(out);
}

/**
 * Converts ProseMirror marks back to Slack rich_text style flags.
 * @param marks - the ProseMirror marks attached to a text node
 * @returns the corresponding Slack style flag object
 */
function marksToStyle(marks: { type: string }[]): RichStyle {
  const style: Record<string, boolean> = {};
  for (const m of marks) {
    if (m.type === 'bold') {
      style.bold = true;
    }
    if (m.type === 'italic') {
      style.italic = true;
    }
    if (m.type === 'strike') {
      style.strike = true;
    }
    if (m.type === 'underline') {
      style.underline = true;
    }
    if (m.type === 'code') {
      style.code = true;
    }
  }
  return style as RichStyle;
}

/**
 * Concatenates adjacent text runs that share the same style flags.
 * @param inlines - inline elements possibly containing splittable runs
 * @returns a new array with adjacent matching text runs merged
 */
function mergeAdjacentTextRuns(inlines: AnyRichTextSectionElement[]): AnyRichTextSectionElement[] {
  const out: AnyRichTextSectionElement[] = [];
  for (const inline of inlines) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.type === 'text' &&
      inline.type === 'text' &&
      sameStyle((prev as { style?: RichStyle }).style, (inline as { style?: RichStyle }).style)
    ) {
      out[out.length - 1] = {
        ...prev,
        text: (prev.text ?? '') + (inline.text ?? '')
      };
      continue;
    }
    out.push(inline);
  }
  return out;
}

/**
 * Returns true when two style flag objects have the same set of keys.
 * @param a - first style flag object
 * @param b - second style flag object
 * @returns true when both have the same active flags
 */
function sameStyle(a: RichStyle | undefined, b: RichStyle | undefined): boolean {
  const ak = a ? Object.keys(a).sort() : [];
  const bk = b ? Object.keys(b).sort() : [];
  if (ak.length !== bk.length) {
    return false;
  }
  return ak.every((k, i) => k === bk[i]);
}
