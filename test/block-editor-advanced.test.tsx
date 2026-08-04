import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlockEditor } from '../src/components/editors/block-editor';
import type { SupportedBlock } from '../src/types';

const ACTIONS: SupportedBlock = {
  type: 'actions',
  elements: [
    {
      type: 'button',
      text: { type: 'plain_text', text: 'Approve', emoji: true },
      action_id: 'button_abc123'
    }
  ]
};

describe('BlockEditor advanced fields', () => {
  it('edits the block_id', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={{ type: 'divider' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Block ID'), { target: { value: 'approval_row' } });

    expect(onChange).toHaveBeenCalledWith({ type: 'divider', block_id: 'approval_row' });
  });

  it('edits a button action_id', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={ACTIONS} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Action ID'), { target: { value: 'approve_request' } });

    expect(onChange).toHaveBeenCalledWith({
      type: 'actions',
      elements: [{ ...ACTIONS.elements[0], action_id: 'approve_request' }]
    });
  });

  it('clearing an id drops the field so Slack generates one', () => {
    const onChange = vi.fn();
    render(<BlockEditor block={ACTIONS} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Action ID'), { target: { value: '' } });

    expect(onChange.mock.calls[0][0].elements[0].action_id).toBeUndefined();
  });
});
