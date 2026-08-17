import { fireEvent, screen } from '@testing-library/react';
import { channelLabel } from '../src/lib/channel-label';

/**
 * Drive the channel combobox the way a user does: click the field to drop the
 * list, then click the row. There's no value to set directly — the picker is a
 * filtering combobox over a listbox, not a `<select>`.
 * @param name - the bare channel name to pick (no `#`)
 * @param fieldLabel - the field's accessible name, when it isn't "Channel"
 */
export async function pickChannel(name: string, fieldLabel = 'Channel'): Promise<void> {
  fireEvent.click(await screen.findByLabelText(fieldLabel));
  fireEvent.click(await screen.findByRole('option', { name: channelLabel(name) }));
}
