import { type Editor, Extension, type Range } from '@tiptap/react';
import { exitSuggestion, Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import type { MentionUser } from '../types';
import { USER_MENTION_NODE } from './rich-text-tiptap';

/** How long the `@` picker waits after a keystroke before searching. */
export const MENTION_SEARCH_DEBOUNCE_MS = 200;

/** The render lifecycle `@tiptap/suggestion` drives the picker UI through. */
export type MentionSuggestionRender = NonNullable<SuggestionOptions<MentionUser, MentionUser>['render']>;

/** Options for {@link MentionSuggestion}. */
export interface MentionSuggestionOptions {
  /** Whether `@` opens the picker; read on every keystroke, so it can change without a new editor. */
  isEnabled: () => boolean;
  /** Runs the host's search; `signal` aborts once a newer query supersedes it. */
  search: (query: string, signal: AbortSignal) => Promise<MentionUser[]>;
  /** Bridges the suggestion lifecycle to the picker UI. */
  render: MentionSuggestionRender;
}

/**
 * Replaces the typed `@query` with a mention of `user` and a trailing space.
 * @param editor - the editor the suggestion belongs to
 * @param range - the `@query` range to replace
 * @param user - the person picked
 */
export function insertUserMention(editor: Editor, range: Range, user: MentionUser) {
  const to =
    editor.state.doc.textBetween(range.to, Math.min(range.to + 1, editor.state.doc.content.size)) === ' '
      ? range.to + 1
      : range.to;
  editor
    .chain()
    .focus()
    .insertContentAt({ from: range.from, to }, [
      { type: USER_MENTION_NODE, attrs: { userId: user.id, name: user.name } },
      { type: 'text', text: ' ' }
    ])
    .run();
}

/**
 * Types an `@` at the cursor so the picker opens, with a leading space when
 * the cursor follows a non-space (the trigger only fires after a space or at
 * the start of a line).
 * @param editor - the editor to insert into
 */
export function insertMentionTrigger(editor: Editor) {
  const { from } = editor.state.selection;
  // A leaf atom (emoji, mention) reads as a non-space too, so the trigger
  // after one still gets its separating space.
  const before = from > 1 ? editor.state.doc.textBetween(from - 1, from, undefined, '￼') : '';
  const needsSpace = before !== '' && !/\s/.test(before);
  editor
    .chain()
    .focus()
    .insertContent(needsSpace ? ' @' : '@')
    .run();
}

/**
 * Closes an open `@` picker without inserting anything, leaving the typed
 * text in place.
 * @param editor - the editor whose suggestion to close
 */
export function dismissMentionSuggestion(editor: Editor) {
  exitSuggestion(editor.view);
}

/**
 * The `@` trigger: a `@tiptap/suggestion` plugin that searches through the
 * host and inserts a {@link USER_MENTION_NODE} for the pick. The `@` inside an
 * email address (`name@domain`) doesn't open it, because the trigger needs a
 * space or line start before it.
 */
export const MentionSuggestion = Extension.create<MentionSuggestionOptions>({
  name: 'userMentionSuggestion',

  addOptions() {
    return {
      isEnabled: () => false,
      search: async () => [],
      render: () => ({})
    };
  },

  addProseMirrorPlugins() {
    const { isEnabled, search, render } = this.options;
    return [
      Suggestion<MentionUser, MentionUser>({
        editor: this.editor,
        char: '@',
        debounce: MENTION_SEARCH_DEBOUNCE_MS,
        allow: () => isEnabled(),
        items: ({ query, signal }) => search(query, signal),
        command: ({ editor, range, props }) => insertUserMention(editor, range, props),
        render
      })
    ];
  }
});
