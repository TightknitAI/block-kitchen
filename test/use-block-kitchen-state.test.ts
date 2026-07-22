import { act, renderHook } from '@testing-library/react';
import { useBlockKitchenState } from '../src/state/use-block-kitchen-state';
import type { ContainerBlock, SupportedBlock } from '../src/types';

const section = (text: string): SupportedBlock => ({ type: 'section', text: { type: 'mrkdwn', text } });
const container = (...children: SupportedBlock[]): SupportedBlock =>
  ({ type: 'container', title: { type: 'plain_text', text: 'C' }, child_blocks: children }) as ContainerBlock;

/** The container payload (with mirrored child_blocks) at a top-level index. */
function payloadAt(result: { current: ReturnType<typeof useBlockKitchenState> }, idx: number) {
  return result.current.blocks[idx].block as ContainerBlock;
}

describe('useBlockKitchenState container nesting', () => {
  it('wraps container child_blocks into a children tree and mirrors back', () => {
    const { result } = renderHook(() =>
      useBlockKitchenState({ initialBlocks: [container(section('a'), section('b'))] })
    );
    const node = result.current.blocks[0];
    expect(node.children).toHaveLength(2);
    // child_blocks stays mirrored from children for serialization.
    expect(payloadAt(result, 0).child_blocks.map((c) => (c as { text: { text: string } }).text.text)).toEqual([
      'a',
      'b'
    ]);
  });

  it('addChild appends an allowed block and re-mirrors child_blocks', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [container(section('a'))] }));
    const parentId = result.current.blocks[0].id;
    act(() => result.current.addChild(parentId, section('b')));
    expect(result.current.blocks[0].children).toHaveLength(2);
    expect(payloadAt(result, 0).child_blocks).toHaveLength(2);
  });

  it('addChild rejects a disallowed child type (e.g. another container)', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [container(section('a'))] }));
    const parentId = result.current.blocks[0].id;
    act(() => result.current.addChild(parentId, container()));
    expect(result.current.blocks[0].children).toHaveLength(1);
  });

  it('moveBlock pulls a top-level block into a container', () => {
    const { result } = renderHook(() =>
      useBlockKitchenState({ initialBlocks: [container(section('a')), section('loose')] })
    );
    const looseId = result.current.blocks[1].id;
    const parentId = result.current.blocks[0].id;
    act(() => result.current.moveBlock(looseId, { kind: 'container', parentId, index: 1 }));
    expect(result.current.blocks).toHaveLength(1); // loose removed from top level
    expect(payloadAt(result, 0).child_blocks).toHaveLength(2);
  });

  it('moveBlock pulls a child back out to the top level', () => {
    const { result } = renderHook(() =>
      useBlockKitchenState({ initialBlocks: [container(section('a'), section('b'))] })
    );
    const childId = result.current.blocks[0].children![1].id;
    act(() => result.current.moveBlock(childId, { kind: 'top', index: 1 }));
    expect(result.current.blocks).toHaveLength(2);
    expect(result.current.blocks[1].block.type).toBe('section');
    expect(payloadAt(result, 0).child_blocks).toHaveLength(1);
  });

  it('moveBlock refuses to nest a container inside a container', () => {
    const { result } = renderHook(() =>
      useBlockKitchenState({ initialBlocks: [container(section('a')), container(section('b'))] })
    );
    const secondId = result.current.blocks[1].id;
    const firstId = result.current.blocks[0].id;
    act(() => result.current.moveBlock(secondId, { kind: 'container', parentId: firstId, index: 1 }));
    expect(result.current.blocks).toHaveLength(2); // unchanged
  });

  it('duplicateBlock deep-clones a container with fresh ids', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [container(section('a'))] }));
    const id = result.current.blocks[0].id;
    act(() => result.current.duplicateBlock(id));
    expect(result.current.blocks).toHaveLength(2);
    const [first, second] = result.current.blocks;
    expect(second.id).not.toBe(first.id);
    expect(second.children![0].id).not.toBe(first.children![0].id);
    expect((second.block as ContainerBlock).child_blocks).toHaveLength(1);
  });

  it('updateBlock on a container keeps its children (editor cannot clobber them)', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [container(section('a'))] }));
    const id = result.current.blocks[0].id;
    // Simulate the editor returning a payload with an empty child_blocks.
    act(() =>
      result.current.updateBlock(id, {
        type: 'container',
        title: { type: 'plain_text', text: 'Renamed' },
        child_blocks: []
      } as ContainerBlock)
    );
    expect(result.current.blocks[0].children).toHaveLength(1);
    expect(payloadAt(result, 0).title.text).toBe('Renamed');
    expect(payloadAt(result, 0).child_blocks).toHaveLength(1);
  });
});

describe('useBlockKitchenState history (undo/redo)', () => {
  const textAt = (result: { current: ReturnType<typeof useBlockKitchenState> }, idx: number) =>
    (result.current.blocks[idx].block as { text: { text: string } }).text.text;

  it('has nothing to undo or redo initially', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [section('a')] }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('undoes and redoes an addBlock', () => {
    const { result } = renderHook(() => useBlockKitchenState({}));
    act(() => result.current.addBlock(section('new')));
    expect(result.current.blocks).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.blocks).toHaveLength(0);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.blocks).toHaveLength(1);
    expect(textAt(result, 0)).toBe('new');
  });

  it('undoes a removeBlock, restoring the block', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [section('a'), section('b')] }));
    const firstId = result.current.blocks[0].id;
    act(() => result.current.removeBlock(firstId));
    expect(result.current.blocks).toHaveLength(1);
    expect(textAt(result, 0)).toBe('b');

    act(() => result.current.undo());
    expect(result.current.blocks).toHaveLength(2);
    expect(textAt(result, 0)).toBe('a');
  });

  it('coalesces consecutive edits to the same block into one undo step', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [section('a')] }));
    const id = result.current.blocks[0].id;
    // Simulate a burst of keystrokes on the same field.
    act(() => result.current.updateBlock(id, section('ab')));
    act(() => result.current.updateBlock(id, section('abc')));
    act(() => result.current.updateBlock(id, section('abcd')));
    expect(textAt(result, 0)).toBe('abcd');

    // A single undo rewinds the whole typing burst back to the original.
    act(() => result.current.undo());
    expect(textAt(result, 0)).toBe('a');
    expect(result.current.canUndo).toBe(false);
  });

  it('keeps edits to different blocks as separate undo steps', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [section('a'), section('b')] }));
    const [idA, idB] = [result.current.blocks[0].id, result.current.blocks[1].id];
    act(() => result.current.updateBlock(idA, section('A')));
    act(() => result.current.updateBlock(idB, section('B')));

    act(() => result.current.undo());
    expect(textAt(result, 0)).toBe('A'); // A's edit survives
    expect(textAt(result, 1)).toBe('b'); // B's edit is undone

    act(() => result.current.undo());
    expect(textAt(result, 0)).toBe('a'); // now A's edit is undone too
  });

  it('treats replaceAll (Clear / JSON apply) as an undoable step', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [section('a'), section('b')] }));
    act(() => result.current.replaceAll([])); // e.g. the toolbar Clear button
    expect(result.current.blocks).toHaveLength(0);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.blocks).toHaveLength(2);
    expect(textAt(result, 0)).toBe('a');
  });

  it('resetAll (loading a new message) starts a fresh baseline with no history', () => {
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [section('a')] }));
    act(() => result.current.addBlock(section('b')));
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.resetAll([section('loaded')]));
    expect(result.current.blocks).toHaveLength(1);
    expect(textAt(result, 0)).toBe('loaded');
    // A loaded message is a new document: undo must not cross the boundary.
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('restores container children (and mirrored child_blocks) on undo', () => {
    const { result } = renderHook(() =>
      useBlockKitchenState({ initialBlocks: [container(section('a'), section('b'))] })
    );
    const childId = result.current.blocks[0].children![0].id;
    act(() => result.current.removeBlock(childId));
    expect(result.current.blocks[0].children).toHaveLength(1);
    expect(payloadAt(result, 0).child_blocks).toHaveLength(1);

    act(() => result.current.undo());
    expect(result.current.blocks[0].children).toHaveLength(2);
    // The serialized child_blocks are mirrored back in lockstep.
    expect(payloadAt(result, 0).child_blocks).toHaveLength(2);
  });

  it('notifies onChange on undo and redo', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useBlockKitchenState({ initialBlocks: [section('a')], onChange }));
    act(() => result.current.addBlock(section('b')));
    onChange.mockClear();

    act(() => result.current.undo());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);

    act(() => result.current.redo());
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0]).toHaveLength(2);
  });
});

describe('useBlockKitchenState replaceAll cleansing', () => {
  it('strips Slack retrieval-only image fields when a message is loaded', () => {
    const { result } = renderHook(() => useBlockKitchenState({}));
    const loaded = [
      {
        type: 'image',
        image_url: 'https://example.com/a.png',
        alt_text: 'ok',
        image_width: 800,
        image_height: 600,
        image_bytes: 12345,
        fallback: '800x600px image',
        is_animated: false
      }
    ] as unknown as SupportedBlock[];
    act(() => result.current.replaceAll(loaded));
    const stored = result.current.blocks[0].block as Record<string, unknown>;
    for (const k of ['image_width', 'image_height', 'image_bytes', 'fallback', 'is_animated']) {
      expect(Object.hasOwn(stored, k)).toBe(false);
    }
    expect(stored.image_url).toBe('https://example.com/a.png');
  });
});
