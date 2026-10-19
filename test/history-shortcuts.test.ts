import { afterEach, expect, it } from 'vitest';
import { historyShortcutOf, isTextEditingTarget } from '../src/lib/history-shortcuts';

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * A key press with the given key and modifiers.
 * @param key - the key's value
 * @param modifiers - the modifiers held
 * @returns the key press
 */
const press = (
  key: string,
  modifiers: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }
) => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers
});

it('reads undo off Ctrl or Cmd + Z, and redo off Shift + Z or Ctrl + Y', () => {
  expect(historyShortcutOf(press('z', { ctrlKey: true }))).toBe('undo');
  expect(historyShortcutOf(press('z', { metaKey: true }))).toBe('undo');
  expect(historyShortcutOf(press('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo');
  expect(historyShortcutOf(press('Z', { metaKey: true, shiftKey: true }))).toBe('redo');
  expect(historyShortcutOf(press('y', { ctrlKey: true }))).toBe('redo');

  expect(historyShortcutOf(press('z', {}))).toBeNull();
  expect(historyShortcutOf(press('z', { ctrlKey: true, altKey: true }))).toBeNull();
  expect(historyShortcutOf(press('x', { metaKey: true }))).toBeNull();
});

it("treats text fields and editable content as the browser's to undo", () => {
  document.body.innerHTML = `
    <input id="input" />
    <textarea id="textarea"></textarea>
    <select id="select"></select>
    <div contenteditable="true"><p id="editable">text</p></div>
    <button id="button" type="button">Delete</button>
    <div id="plain">Block preview</div>`;
  const byId = (id: string) => document.getElementById(id);

  for (const id of ['input', 'textarea', 'select', 'editable']) {
    expect(isTextEditingTarget(byId(id))).toBe(true);
  }
  for (const id of ['button', 'plain']) {
    expect(isTextEditingTarget(byId(id))).toBe(false);
  }
  expect(isTextEditingTarget(document)).toBe(false);
  expect(isTextEditingTarget(null)).toBe(false);
});
