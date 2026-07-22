import { act, renderHook } from '@testing-library/react';
import { MAX_HISTORY, useHistoryState } from '../src/state/use-history-state';

describe('useHistoryState', () => {
  it('starts with no undo/redo available', () => {
    const { result } = renderHook(() => useHistoryState(0));
    expect(result.current.present).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('accepts a lazy initializer', () => {
    const { result } = renderHook(() => useHistoryState(() => 42));
    expect(result.current.present).toBe(42);
  });

  it('commits, undoes, and redoes a value', () => {
    const { result } = renderHook(() => useHistoryState(0));
    act(() => result.current.commit(1));
    expect(result.current.present).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());
    expect(result.current.present).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.present).toBe(1);
    expect(result.current.canRedo).toBe(false);
  });

  it('supports the updater form', () => {
    const { result } = renderHook(() => useHistoryState(10));
    act(() => result.current.commit((prev) => prev + 5));
    expect(result.current.present).toBe(15);
  });

  it('a new commit clears the redo branch', () => {
    const { result } = renderHook(() => useHistoryState(0));
    act(() => result.current.commit(1));
    act(() => result.current.commit(2));
    act(() => result.current.undo());
    expect(result.current.present).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.commit(9));
    expect(result.current.present).toBe(9);
    expect(result.current.canRedo).toBe(false);
  });

  it('ignores a referentially-identical (no-op) commit', () => {
    const { result } = renderHook(() => useHistoryState({ a: 1 }));
    const initial = result.current.present;
    act(() => result.current.commit((prev) => prev)); // returns the same reference
    expect(result.current.present).toBe(initial);
    expect(result.current.canUndo).toBe(false);
  });

  it('coalesces consecutive same-tag commits into one undo step', () => {
    const { result } = renderHook(() => useHistoryState(''));
    act(() => result.current.commit('h', { tag: 'text' }));
    act(() => result.current.commit('he', { tag: 'text' }));
    act(() => result.current.commit('hel', { tag: 'text' }));
    expect(result.current.present).toBe('hel');

    // One undo rewinds the entire coalesced run, not a single keystroke.
    act(() => result.current.undo());
    expect(result.current.present).toBe('');
    expect(result.current.canUndo).toBe(false);
  });

  it('starts a new step when the tag changes', () => {
    const { result } = renderHook(() => useHistoryState('start'));
    act(() => result.current.commit('a', { tag: 'a' }));
    act(() => result.current.commit('b', { tag: 'b' }));
    act(() => result.current.undo());
    expect(result.current.present).toBe('a');
    act(() => result.current.undo());
    expect(result.current.present).toBe('start');
  });

  it('starts a new step when an untagged commit follows a tagged run', () => {
    const { result } = renderHook(() => useHistoryState('start'));
    act(() => result.current.commit('a', { tag: 'text' }));
    act(() => result.current.commit('b')); // untagged: its own step
    act(() => result.current.undo());
    expect(result.current.present).toBe('a');
  });

  it('does not coalesce across an undo (the tag run is broken)', () => {
    const { result } = renderHook(() => useHistoryState('start'));
    act(() => result.current.commit('a', { tag: 'text' }));
    act(() => result.current.undo()); // back to "start"
    act(() => result.current.commit('b', { tag: 'text' }));
    // The post-undo commit is a fresh step even though it reuses the tag.
    act(() => result.current.undo());
    expect(result.current.present).toBe('start');
  });

  it('reset replaces the value and clears all history', () => {
    const { result } = renderHook(() => useHistoryState(0));
    act(() => result.current.commit(1));
    act(() => result.current.commit(2));
    act(() => result.current.reset(99));
    expect(result.current.present).toBe(99);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps retained history at MAX_HISTORY steps', () => {
    const { result } = renderHook(() => useHistoryState(0));
    const commits = MAX_HISTORY + 25;
    for (let i = 1; i <= commits; i++) {
      act(() => result.current.commit(i));
    }
    // Undo as far as it will go, counting the steps.
    let steps = 0;
    while (result.current.canUndo) {
      act(() => result.current.undo());
      steps++;
    }
    expect(steps).toBe(MAX_HISTORY);
    // The oldest snapshots fell off the back, so we can't reach the original 0.
    expect(result.current.present).toBe(commits - MAX_HISTORY);
  });
});
