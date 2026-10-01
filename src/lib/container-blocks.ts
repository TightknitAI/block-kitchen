import type { ContainerBlock, SupportedBlockType } from '../types';

/**
 * Block types Slack allows inside a `container` block's `child_blocks`.
 * Mirrors the validator schema (actions, context, divider, file, header,
 * image, input, rich_text, section, table, video) across the types the
 * builder models — `file` is omitted because the builder has no file block,
 * and `container` is excluded since containers don't nest.
 * @see https://docs.slack.dev/reference/block-kit/blocks/container-block
 */
export const CONTAINER_CHILD_TYPES: ReadonlySet<SupportedBlockType> = new Set([
  'actions',
  'context',
  'divider',
  'header',
  'image',
  'input',
  'rich_text',
  'section',
  'table',
  'video'
]);

/** Max child blocks Slack accepts in a container. */
export const MAX_CONTAINER_CHILDREN = 10;

/** Whether a block type may be dropped inside a container. */
export function isContainerChildType(type: SupportedBlockType): boolean {
  return CONTAINER_CHILD_TYPES.has(type);
}

/** dnd-kit droppable id prefix for a container's body (the child drop zone). */
const BODY_PREFIX = 'container-body:';

/** Build the droppable id for a container body. */
export function containerBodyId(containerId: string): string {
  return `${BODY_PREFIX}${containerId}`;
}

/** Parse a container-body droppable id back to its container id, or null. */
export function parseContainerBodyId(id: string | number): string | null {
  if (typeof id !== 'string' || !id.startsWith(BODY_PREFIX)) {
    return null;
  }
  return id.slice(BODY_PREFIX.length);
}

/**
 * Plain-text rendering of a single rich_text leaf element, for compact
 * labels. Mentions keep their sigil so they still read as mentions.
 */
function richTextLeafText(el: Record<string, unknown>): string {
  switch (el.type) {
    case 'text':
      return String(el.text ?? '');
    case 'link':
      return String(el.text || el.url || '');
    case 'emoji':
      return `:${el.name}:`;
    case 'user':
      return `@${el.user_id}`;
    case 'usergroup':
      return `@${el.usergroup_id}`;
    case 'channel':
      return `#${el.channel_id}`;
    case 'broadcast':
      return `@${el.range}`;
    case 'date':
      return String(el.fallback ?? '');
    default:
      return '';
  }
}

/** Concatenate the visible text of a rich_text node and its descendants. */
function richTextNodeText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }
  const el = node as Record<string, unknown>;
  if (Array.isArray(el.elements)) {
    return el.elements.map(richTextNodeText).join(el.type === 'rich_text' || el.type === 'rich_text_list' ? ' ' : '');
  }
  return richTextLeafText(el);
}

/**
 * The text a container's header shows: `rich_text_title` flattened to
 * plain text when it has any, else `title`. Slack renders
 * `rich_text_title` when both are set, so this follows the same order.
 * @param block - the container block
 * @returns the header text, or `''` when neither title has content
 */
export function containerTitleText(block: ContainerBlock): string {
  const rich = richTextNodeText(block.rich_text_title).replace(/\s+/g, ' ').trim();
  return rich || block.title?.text || '';
}
