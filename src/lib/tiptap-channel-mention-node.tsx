import { mergeAttributes, Node, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useMentions } from '../state/mentions-context';
import { CHANNEL_MENTION_NODE } from './rich-text-tiptap';

/** Attributes carried by the inline {@link ChannelMentionNode}. */
export interface ChannelMentionNodeAttrs {
  /** Slack channel id (`C…` / `G…`). */
  channelId: string;
  /** Name picked from the `#` search, or null for loaded content. */
  name: string | null;
}

/**
 * Picks the visible channel label from the host, the picker, or the raw id.
 * @param attrs - the mention's attributes
 * @param getChannelName - the host's optional name lookup
 * @returns the label, without the leading `#`
 */
export function channelMentionLabel(
  attrs: ChannelMentionNodeAttrs,
  getChannelName?: (channelId: string) => string | undefined
): string {
  return getChannelName?.(attrs.channelId) ?? attrs.name ?? attrs.channelId;
}

function ChannelMentionNodeView({ node }: NodeViewProps) {
  const mentions = useMentions();
  const attrs = node.attrs as ChannelMentionNodeAttrs;
  return (
    <NodeViewWrapper as="span" className="bk-channel-mention" data-channel-mention={attrs.channelId}>
      #{channelMentionLabel(attrs, mentions?.getChannelName)}
    </NodeViewWrapper>
  );
}

/** Inline, atomic TipTap node for a Slack rich text `channel` element. */
export const ChannelMentionNode = Node.create({
  name: CHANNEL_MENTION_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      channelId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-channel-mention') ?? '',
        renderHTML: (attributes: { channelId: string }) => ({ 'data-channel-mention': attributes.channelId })
      },
      name: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-channel-name'),
        renderHTML: (attributes: { name: string | null }) =>
          attributes.name ? { 'data-channel-name': attributes.name } : {}
      }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-channel-mention]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), `#${channelMentionLabel(node.attrs as ChannelMentionNodeAttrs)}`];
  },

  renderText({ node }) {
    return `#${channelMentionLabel(node.attrs as ChannelMentionNodeAttrs)}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChannelMentionNodeView);
  }
});
