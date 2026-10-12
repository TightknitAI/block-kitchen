import { mergeAttributes, Node, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { useMentions } from '../state/mentions-context';
import { USER_MENTION_NODE } from './rich-text-tiptap';

/**
 * Attributes carried by the inline {@link UserMentionNode}. Only `userId`
 * survives export to Slack; `name` is the label the picker inserted it with.
 */
export interface UserMentionNodeAttrs {
  /** Slack user id (`U…` / `W…`). */
  userId: string;
  /** Name picked from the `@` search, or null for a mention that came with the content. */
  name: string | null;
}

/**
 * Picks the visible label for a mention: the host's lookup first, so names
 * resolve (and re-resolve) as the host learns them, then the picked name,
 * then the raw id.
 * @param attrs - the mention's attributes
 * @param getUserName - the host's optional name lookup
 * @returns the label, without the leading `@`
 */
export function userMentionLabel(
  attrs: UserMentionNodeAttrs,
  getUserName?: (userId: string) => string | undefined
): string {
  return getUserName?.(attrs.userId) ?? attrs.name ?? attrs.userId;
}

/**
 * React NodeView for a user mention, styled like Slack's own mention chip.
 * @param props - TipTap node-view props
 * @returns the rendered inline mention
 */
function UserMentionNodeView({ node }: NodeViewProps) {
  const mentions = useMentions();
  const attrs = node.attrs as UserMentionNodeAttrs;
  return (
    <NodeViewWrapper as="span" className="bk-user-mention" data-user-mention={attrs.userId}>
      @{userMentionLabel(attrs, mentions?.getUserName)}
    </NodeViewWrapper>
  );
}

/**
 * Inline, atomic TipTap node for a Slack rich text `user` element, inserted by
 * the `@` picker or seeded from the payload. Serializes to a
 * `<span data-user-mention>` so copy/paste inside the editor keeps it; the
 * canonical round-trip is `rich-text-tiptap.ts`'s ProseMirror ⇄ Slack
 * converter.
 */
export const UserMentionNode = Node.create({
  name: USER_MENTION_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      userId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-user-mention') ?? '',
        renderHTML: (attributes: { userId: string }) => ({ 'data-user-mention': attributes.userId })
      },
      name: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-user-name'),
        renderHTML: (attributes: { name: string | null }) =>
          attributes.name ? { 'data-user-name': attributes.name } : {}
      }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-user-mention]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), `@${userMentionLabel(node.attrs as UserMentionNodeAttrs)}`];
  },

  renderText({ node }) {
    return `@${userMentionLabel(node.attrs as UserMentionNodeAttrs)}`;
  },

  addNodeView() {
    return ReactNodeViewRenderer(UserMentionNodeView);
  }
});
