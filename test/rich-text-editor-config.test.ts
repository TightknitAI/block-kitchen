import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { buildRichTextExtensions, RICH_TEXT_INPUT_RULE_ALLOWLIST } from '../src/components/editors/rich-text-editor';

/**
 * Builds a headless editor with the production extension set. `element` is a
 * detached node so ProseMirror can mount a view in jsdom without rendering.
 */
function makeEditor(opts?: { enableInputRules?: boolean | string[] }) {
  return new Editor({
    element: document.createElement('div'),
    extensions: buildRichTextExtensions(),
    enableInputRules: opts?.enableInputRules ?? RICH_TEXT_INPUT_RULE_ALLOWLIST,
    content: '<p></p>'
  });
}

/** Drives text input char-by-char so ProseMirror input rules fire as they would on real typing. */
function typeText(editor: Editor, text: string) {
  for (const ch of text) {
    const { from, to } = editor.state.selection;
    const handled = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, ch));
    if (!handled) {
      editor.view.dispatch(editor.state.tr.insertText(ch, from, to));
    }
  }
}

/** True when any text node in the doc carries a mark of the given name. */
function hasMark(editor: Editor, markName: string): boolean {
  let found = false;
  editor.state.doc.descendants((node) => {
    if (node.marks.some((m) => m.type.name === markName)) {
      found = true;
    }
  });
  return found;
}

describe('rich-text editor config: input rules (ENG-4850 #2)', () => {
  it('does NOT convert a literal "2. " line start into an ordered list', () => {
    const editor = makeEditor();
    typeText(editor, '2. Buy milk');
    expect(editor.isActive('orderedList')).toBe(false);
    expect(editor.getText()).toBe('2. Buy milk');
    editor.destroy();
  });

  it('does NOT convert a literal "- " line start into a bullet list', () => {
    const editor = makeEditor();
    typeText(editor, '- groceries');
    expect(editor.isActive('bulletList')).toBe(false);
    expect(editor.getText()).toBe('- groceries');
    editor.destroy();
  });

  it('does NOT convert "> " into a blockquote', () => {
    const editor = makeEditor();
    typeText(editor, '> note');
    expect(editor.isActive('blockquote')).toBe(false);
    expect(editor.getText()).toBe('> note');
    editor.destroy();
  });

  it('still exposes the ordered-list command for the toolbar button', () => {
    const editor = makeEditor();
    editor.chain().focus().toggleOrderedList().run();
    expect(editor.isActive('orderedList')).toBe(true);
    editor.destroy();
  });

  it('keeps inline mark shortcuts (the allowlist is not "disable everything")', () => {
    const editor = makeEditor();
    typeText(editor, '**bold** ');
    // Scan the doc rather than isActive(): the trailing space moves the
    // cursor out of the bolded range.
    expect(hasMark(editor, 'bold')).toBe(true);
    editor.destroy();
  });

  it('registers the underline mark and toggleUnderline command for the toolbar button', () => {
    const editor = makeEditor();
    // Apply underline to real text: toggling on an empty selection only sets a
    // stored mark, which hasMark (a doc scan) can't observe.
    editor.chain().focus().insertContent('hi').selectAll().toggleUnderline().run();
    expect(editor.isActive('underline')).toBe(true);
    expect(hasMark(editor, 'underline')).toBe(true);
    editor.destroy();
  });

  it('sanity check: the SAME typing DOES make a list under default input rules', () => {
    // Confirms the harness really triggers input rules — so the tests above
    // pass because of the allowlist, not because typing never fires a rule.
    const editor = new Editor({
      element: document.createElement('div'),
      extensions: [StarterKit.configure({ heading: false, horizontalRule: false })],
      content: '<p></p>'
    });
    typeText(editor, '2. Buy milk');
    expect(editor.isActive('orderedList')).toBe(true);
    editor.destroy();
  });
});

describe('rich-text editor config: autolink (ENG-4850 #1)', () => {
  // The autolinker fires when a space is typed after a URL-like token, so
  // we type the token followed by a space (char-by-char) to exercise it.
  it.each([
    '2.xyz',
    'report.zip',
    'logo.png',
    'example.com',
    'www.example.com',
    'v2.api'
  ])('does NOT auto-link bare host-like token %p', (token) => {
    const editor = makeEditor();
    typeText(editor, `${token} `);
    expect(hasMark(editor, 'link')).toBe(false);
    editor.destroy();
  });

  it('DOES auto-link a URL typed with an explicit https scheme', () => {
    const editor = makeEditor();
    typeText(editor, 'https://example.com ');
    expect(hasMark(editor, 'link')).toBe(true);
    editor.destroy();
  });

  it('does NOT auto-link an unsafe scheme', () => {
    const editor = makeEditor();
    typeText(editor, 'javascript:alert(1) ');
    expect(hasMark(editor, 'link')).toBe(false);
    editor.destroy();
  });

  it('registers exactly one link mark (no duplicate from StarterKit)', () => {
    const editor = makeEditor();
    const linkExtensions = editor.extensionManager.extensions.filter((e) => e.name === 'link');
    expect(linkExtensions).toHaveLength(1);
    editor.destroy();
  });
});
