import type { SupportedBlockType } from '../types';

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
