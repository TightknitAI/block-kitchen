import { mergeAttributes, Node, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { codepointsToGlyph } from './emoji-data';

/**
 * Attributes carried by the inline {@link EmojiNode}. `src` (custom image) and
 * `unicode` (codepoints) are render-only; only `name` (+ `skinTone`) survive
 * export to Slack.
 */
export interface EmojiNodeAttrs {
  /** Slack codename, no colons (`wave`). */
  name: string;
  /** Workspace custom-emoji image URL, or null for a standard emoji. */
  src: string | null;
  /** Base Unicode codepoint(s), lowercased (`1f44b`), or null. */
  unicode: string | null;
  /** Slack `skin_tone` (2–6), or null. */
  skinTone: number | null;
}

/**
 * React NodeView for an emoji. Renders the workspace custom image when `src`
 * is present, otherwise the Unicode glyph (derived from `unicode`), falling
 * back to the `:name:` shortcode text when neither is available.
 * @param props - TipTap node-view props
 * @returns the rendered inline emoji
 */
function EmojiNodeView({ node }: NodeViewProps) {
  const { name, src, unicode } = node.attrs as EmojiNodeAttrs;
  const label = `:${name}:`;
  return (
    <NodeViewWrapper as="span" className="bk-emoji-node" data-emoji={name} title={label}>
      {src ? (
        <img
          src={src}
          alt={label}
          style={{
            display: 'inline-block',
            width: '1.25em',
            height: '1.25em',
            verticalAlign: '-0.25em',
            objectFit: 'contain'
          }}
        />
      ) : (
        <span aria-label={label} role="img">
          {unicode ? codepointsToGlyph(unicode) : label}
        </span>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Inline, atomic TipTap node representing a Slack emoji. Backed by
 * {@link EmojiNodeView}. Serializes to a `<span data-emoji>` in HTML so
 * copy/paste keeps a recognizable marker, but the canonical round-trip is
 * through `rich-text-tiptap.ts`'s ProseMirror ⇄ Slack converter.
 */
export const EmojiNode = Node.create({
  name: 'emoji',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      name: { default: '' },
      src: { default: null },
      unicode: { default: null },
      skinTone: { default: null }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-emoji]' }];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    const name = (HTMLAttributes.name as string | undefined) ?? '';
    return ['span', mergeAttributes({ 'data-emoji': name }, HTMLAttributes), `:${name}:`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmojiNodeView);
  }
});
