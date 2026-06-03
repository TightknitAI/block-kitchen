import { Smile } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/cn';
import { Popover, PopoverContent, PopoverTrigger } from '../../lib/ui/popover';
import { EmojiPicker, type EmojiSelection } from './emoji-picker';

/**
 * An "insert emoji" trigger that opens the {@link EmojiPicker} in a popover and
 * emits the resolved {@link EmojiSelection} on pick (closing the popover).
 *
 * @param props.onSelect - called with the resolved selection when an emoji is picked
 * @param props.className - extra classes for the trigger button
 * @param props.label - accessible label / tooltip (default "Insert emoji")
 * @param props.align - popover alignment (default "start")
 */
export function EmojiPickerButton({
  onSelect,
  className,
  label = 'Insert emoji',
  align = 'start'
}: {
  onSelect: (selection: EmojiSelection) => void;
  className?: string;
  label?: string;
  align?: 'start' | 'center' | 'end';
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            'flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            className
          )}
        >
          <Smile className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto p-2">
        <EmojiPicker
          onSelect={(selection) => {
            onSelect(selection);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
