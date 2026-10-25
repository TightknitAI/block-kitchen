import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';
import { cn } from '../cn';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 8, collisionPadding = 16, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(
        'bk-portal-content z-50 max-h-[var(--radix-popover-content-available-height)] w-80 overflow-y-auto rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

/**
 * An `onCloseAutoFocus` for {@link PopoverContent} that returns focus to the
 * trigger only when focus hasn't already moved elsewhere. Clicking another
 * popover's trigger opens that popover in the same click, and returning
 * focus to this trigger afterwards would land outside it and close it again.
 * @param event - the close auto-focus event, dispatched on the closing content
 */
export function returnFocusUnlessMoved(event: Event): void {
  const active = document.activeElement;
  const closing = event.target instanceof Node ? event.target : null;
  if (active && active !== document.body && !closing?.contains(active)) {
    event.preventDefault();
  }
}

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
