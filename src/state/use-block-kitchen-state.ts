import { nanoid } from 'nanoid';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isContainerChildType, MAX_CONTAINER_CHILDREN } from '../lib/container-blocks';
import { sanitizeBlocks } from '../lib/sanitize-blocks';
import type { BuilderBlock, ContainerBlock, SupportedBlock } from '../types';

/**
 * Re-derive a container node's `block.child_blocks` from its `children`
 * array, keeping the serialized payload in lockstep with the builder tree.
 * No-op for non-container nodes.
 */
function mirror(node: BuilderBlock): BuilderBlock {
  if (!node.children) {
    return node;
  }
  return {
    ...node,
    block: { ...(node.block as ContainerBlock), child_blocks: node.children.map((c) => c.block) } as SupportedBlock
  };
}

/**
 * Wraps a Slack block payload in a {@link BuilderBlock} with a fresh client
 * id. Container payloads recursively wrap their `child_blocks` into
 * `children` (the DnD-authoritative store).
 * @param block - the underlying Slack block payload
 * @returns a builder-side block with id
 */
function wrap(block: SupportedBlock): BuilderBlock {
  if (block.type === 'container') {
    const children = ((block as ContainerBlock).child_blocks ?? []).map(wrap);
    return mirror({ id: nanoid(8), block, children });
  }
  return { id: nanoid(8), block };
}

/** Deep-clone a node with fresh ids throughout (for duplicate). */
function cloneNode(node: BuilderBlock): BuilderBlock {
  if (node.children) {
    return mirror({ id: nanoid(8), block: structuredClone(node.block), children: node.children.map(cloneNode) });
  }
  return { id: nanoid(8), block: structuredClone(node.block) };
}

/** Replace a node's own payload, preserving (and re-mirroring) its children. */
function applyUpdate(node: BuilderBlock, block: SupportedBlock): BuilderBlock {
  if (node.children) {
    // Editors don't manage container children (that's the canvas's job), so
    // keep the existing children and re-mirror — the editor's payload can't
    // clobber the child list.
    return mirror({ ...node, block });
  }
  return { ...node, block };
}

/** A node's location in the depth-2 tree. */
type Loc = { kind: 'top'; index: number } | { kind: 'child'; parentId: string; index: number };

/** Find a node by id across the top level and every container's children. */
function locate(blocks: BuilderBlock[], id: string): Loc | null {
  const top = blocks.findIndex((b) => b.id === id);
  if (top !== -1) {
    return { kind: 'top', index: top };
  }
  for (const block of blocks) {
    if (block.children) {
      const idx = block.children.findIndex((c) => c.id === id);
      if (idx !== -1) {
        return { kind: 'child', parentId: block.id, index: idx };
      }
    }
  }
  return null;
}

/** Map over the children of one container by id, re-mirroring the result. */
function withChildren(
  blocks: BuilderBlock[],
  parentId: string,
  fn: (children: BuilderBlock[]) => BuilderBlock[]
): BuilderBlock[] {
  return blocks.map((b) => (b.id === parentId && b.children ? mirror({ ...b, children: fn(b.children) }) : b));
}

/**
 * Destination for a drag-and-drop move. `index` is the position in the
 * destination list (the hovered sibling's index, or the list length to
 * append). For a same-list reorder the node is removed first and re-spliced
 * at `index`, matching dnd-kit's sortable behavior.
 */
export type MoveTarget = { kind: 'top'; index: number } | { kind: 'container'; parentId: string; index: number };

/**
 * Reactive state for the builder's working draft.
 *
 * - `blocks`: ordered list of {@link BuilderBlock} (id + payload + optional
 *   container `children`).
 * - Mutators operate on ids, not indices, and resolve a node whether it
 *   lives at the top level or inside a container.
 * - On any change, calls the optional `onChange` with the unwrapped Slack
 *   payloads (container `child_blocks` mirrored in) so the consumer can
 *   persist (URL, localStorage, etc).
 * @param params - hook params
 * @param params.initialBlocks - starting payloads
 * @param params.onChange - notified on any state change with Slack payloads
 * @returns state slice + mutators
 */
export function useBlockKitchenState({
  initialBlocks,
  onChange
}: {
  initialBlocks?: SupportedBlock[];
  onChange?: (blocks: SupportedBlock[]) => void;
} = {}) {
  const [blocks, setBlocks] = useState<BuilderBlock[]>(() => (initialBlocks ?? []).map(wrap));

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const isFirstRunRef = useRef(true);
  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    onChangeRef.current?.(blocks.map((b) => b.block));
  }, [blocks]);

  const addBlock = useCallback((block: SupportedBlock, atIndex?: number) => {
    setBlocks((prev) => {
      const next = [...prev];
      const idx = atIndex === undefined ? next.length : Math.max(0, Math.min(atIndex, next.length));
      next.splice(idx, 0, wrap(block));
      return next;
    });
  }, []);

  const addChild = useCallback((parentId: string, block: SupportedBlock, atIndex?: number) => {
    if (!isContainerChildType(block.type)) {
      return;
    }
    setBlocks((prev) =>
      withChildren(prev, parentId, (children) => {
        if (children.length >= MAX_CONTAINER_CHILDREN) {
          return children;
        }
        const next = [...children];
        const idx = atIndex === undefined ? next.length : Math.max(0, Math.min(atIndex, next.length));
        next.splice(idx, 0, wrap(block));
        return next;
      })
    );
  }, []);

  const updateBlock = useCallback((id: string, block: SupportedBlock) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          return applyUpdate(b, block);
        }
        if (b.children?.some((c) => c.id === id)) {
          return mirror({ ...b, children: b.children.map((c) => (c.id === id ? applyUpdate(c, block) : c)) });
        }
        return b;
      })
    );
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      if (prev.some((b) => b.id === id)) {
        return prev.filter((b) => b.id !== id);
      }
      return prev.map((b) =>
        b.children?.some((c) => c.id === id) ? mirror({ ...b, children: b.children.filter((c) => c.id !== id) }) : b
      );
    });
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setBlocks((prev) => {
      const loc = locate(prev, id);
      if (!loc) {
        return prev;
      }
      if (loc.kind === 'top') {
        const next = [...prev];
        next.splice(loc.index + 1, 0, cloneNode(prev[loc.index]));
        return next;
      }
      return withChildren(prev, loc.parentId, (children) => {
        const next = [...children];
        next.splice(loc.index + 1, 0, cloneNode(children[loc.index]));
        return next;
      });
    });
  }, []);

  const reorderBlock = useCallback((fromId: string, toIndex: number) => {
    setBlocks((prev) => {
      const loc = locate(prev, fromId);
      if (!loc) {
        return prev;
      }
      const reorder = (list: BuilderBlock[]) => {
        const next = [...list];
        const [moved] = next.splice(loc.index, 1);
        next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
        return next;
      };
      if (loc.kind === 'top') {
        return reorder(prev);
      }
      return withChildren(prev, loc.parentId, reorder);
    });
  }, []);

  const moveBlock = useCallback((activeId: string, target: MoveTarget) => {
    setBlocks((prev) => {
      const loc = locate(prev, activeId);
      if (!loc) {
        return prev;
      }
      const moved =
        loc.kind === 'top' ? prev[loc.index] : prev.find((b) => b.id === loc.parentId)?.children?.[loc.index];
      if (!moved) {
        return prev;
      }

      if (target.kind === 'container') {
        // Containers can't nest, and only allowed child types may enter.
        if (moved.children || !isContainerChildType(moved.block.type)) {
          return prev;
        }
        // Enforce the child cap, but never against a reorder within the same
        // container (which doesn't grow it).
        const sameContainer = loc.kind === 'child' && loc.parentId === target.parentId;
        const destCount = prev.find((b) => b.id === target.parentId)?.children?.length ?? 0;
        if (!sameContainer && destCount >= MAX_CONTAINER_CHILDREN) {
          return prev;
        }
      }

      // Detach from the source list, then splice into the destination.
      const detached =
        loc.kind === 'top'
          ? prev.filter((_, i) => i !== loc.index)
          : withChildren(prev, loc.parentId, (children) => children.filter((_, i) => i !== loc.index));

      const insert = (list: BuilderBlock[]) => {
        const next = [...list];
        next.splice(Math.max(0, Math.min(target.index, next.length)), 0, moved);
        return next;
      };
      return target.kind === 'container' ? withChildren(detached, target.parentId, insert) : insert(detached);
    });
  }, []);

  // Full-replace entry point for loading an existing message, "open as new",
  // and JSON-drawer apply. Cleanse here (not just at send) so blocks pulled
  // from a retrieved message enter the working state already send-valid —
  // dropping Slack's retrieval-only fields and scrubbing unsafe URLs.
  const replaceAll = useCallback((newBlocks: SupportedBlock[]) => {
    setBlocks(sanitizeBlocks(newBlocks).map(wrap));
  }, []);

  return {
    blocks,
    addBlock,
    addChild,
    updateBlock,
    removeBlock,
    duplicateBlock,
    reorderBlock,
    moveBlock,
    replaceAll
  };
}
