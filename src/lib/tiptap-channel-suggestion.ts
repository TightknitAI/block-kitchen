import { PluginKey } from '@tiptap/pm/state';
import { type Editor, Extension, type Range } from '@tiptap/react';
import { exitSuggestion, Suggestion, type SuggestionOptions } from '@tiptap/suggestion';
import type { MentionChannel } from '../types';
import { CHANNEL_MENTION_NODE } from './rich-text-tiptap';
import { insertSuggestionTrigger, MENTION_SEARCH_DEBOUNCE_MS } from './tiptap-mention-suggestion';

/** ProseMirror key dedicated to the `#` suggestion plugin. */
export const CHANNEL_MENTION_SUGGESTION_PLUGIN_KEY = new PluginKey('channelMentionSuggestion');

export type ChannelSuggestionRender = NonNullable<SuggestionOptions<MentionChannel, MentionChannel>['render']>;

/** Options for {@link ChannelSuggestion}. */
export interface ChannelSuggestionOptions {
  /** Whether `#` opens the picker. */
  isEnabled: () => boolean;
  /** Runs the host's channel search. */
  search: (query: string, signal: AbortSignal) => Promise<MentionChannel[]>;
  /** Bridges the suggestion lifecycle to the picker UI. */
  render: ChannelSuggestionRender;
}

/** Replaces the typed `#query` with a channel mention and trailing space. */
export function insertChannelMention(editor: Editor, range: Range, channel: MentionChannel) {
  const to =
    editor.state.doc.textBetween(range.to, Math.min(range.to + 1, editor.state.doc.content.size)) === ' '
      ? range.to + 1
      : range.to;
  editor
    .chain()
    .focus()
    .insertContentAt({ from: range.from, to }, [
      { type: CHANNEL_MENTION_NODE, attrs: { channelId: channel.id, name: channel.name } },
      { type: 'text', text: ' ' }
    ])
    .run();
}

/** Types a `#` at a valid trigger position so the channel picker opens. */
export function insertChannelTrigger(editor: Editor) {
  insertSuggestionTrigger(editor, '#');
}

/** Closes an open `#` picker without inserting anything. */
export function dismissChannelSuggestion(editor: Editor) {
  exitSuggestion(editor.view, CHANNEL_MENTION_SUGGESTION_PLUGIN_KEY);
}

/** Host-backed `#` trigger that inserts Slack channel elements. */
export const ChannelSuggestion = Extension.create<ChannelSuggestionOptions>({
  name: 'channelMentionSuggestion',

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
      Suggestion<MentionChannel, MentionChannel>({
        editor: this.editor,
        pluginKey: CHANNEL_MENTION_SUGGESTION_PLUGIN_KEY,
        char: '#',
        debounce: MENTION_SEARCH_DEBOUNCE_MS,
        allow: () => isEnabled(),
        items: ({ query, signal }) => search(query, signal),
        command: ({ editor, range, props }) => insertChannelMention(editor, range, props),
        render
      })
    ];
  }
});
