import { createContext, type ReactNode, useContext } from 'react';
import type { MentionsConfig } from '../types';

const MentionsContext = createContext<MentionsConfig | null>(null);

/**
 * Provides the host's {@link MentionsConfig} to the builder tree, so the rich
 * text editor (and the mention chips TipTap renders inside it) can reach the
 * search and name lookup without prop-drilling through
 * `Surface → block-row → block-editor → *-editor`.
 *
 * @param props.mentions - the host's mentions config, or undefined to disable the picker
 * @param props.children - the subtree that can read the context
 */
export function MentionsProvider({ mentions, children }: { mentions?: MentionsConfig; children: ReactNode }) {
  return <MentionsContext.Provider value={mentions ?? null}>{children}</MentionsContext.Provider>;
}

/**
 * Reads the mentions config. Returns null outside a {@link MentionsProvider}
 * or when the host passed none, so it is always safe to call.
 */
export function useMentions(): MentionsConfig | null {
  return useContext(MentionsContext);
}
