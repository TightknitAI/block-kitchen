import { createContext, type ReactNode, useContext } from 'react';
import type { CustomBlockEditor, SupportedBlock } from '../types';

const BlockEditorsContext = createContext<readonly CustomBlockEditor[]>([]);

/**
 * Provides the host's {@link CustomBlockEditor}s to the builder tree, so the
 * block editor can swap in a host form without prop-drilling through
 * `Surface → block-row → block-editor`.
 *
 * @param props.blockEditors - the host's editors, or undefined for none
 * @param props.children - the subtree that can read the context
 */
export function BlockEditorsProvider({
  blockEditors,
  children
}: {
  blockEditors?: readonly CustomBlockEditor[];
  children: ReactNode;
}) {
  return <BlockEditorsContext.Provider value={blockEditors ?? []}>{children}</BlockEditorsContext.Provider>;
}

/**
 * Finds the host editor for a block. Returns undefined outside a
 * {@link BlockEditorsProvider} or when no editor matches, so it is always
 * safe to call.
 * @param block - the block being edited
 * @returns the first host editor whose `match` accepts the block
 */
export function useCustomBlockEditor(block: SupportedBlock): CustomBlockEditor | undefined {
  return useContext(BlockEditorsContext).find((editor) => editor.match(block));
}
