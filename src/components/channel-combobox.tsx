import { Check, ChevronsUpDown } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { channelLabel } from '../lib/channel-label';
import { cn } from '../lib/cn';
import { Input } from '../lib/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '../lib/ui/popover';
import type { ChannelOption } from '../types';

/**
 * Match a channel name against what's typed. The `#` and the space after it
 * come from the display label, not from the name, so they're stripped before
 * comparing — someone who types (or pastes back) `# gen` means `general`.
 * @param name - the channel name to test
 * @param query - the raw text in the input
 * @returns whether the channel belongs in the filtered list
 */
function matchesQuery(name: string, query: string): boolean {
  const needle = query
    .replace(/^\s*#\s*/, '')
    .trim()
    .toLowerCase();
  return needle === '' || name.toLowerCase().includes(needle);
}

/**
 * Type-to-filter channel picker: a text input that narrows the channel list as
 * you type, over a listbox of the matches. Replaces a plain `<select>`, which
 * stops being usable once a workspace has more channels than fit on screen.
 *
 * Follows the WAI-ARIA combobox pattern with manual selection: focus stays in
 * the input and the active row is pointed at with `aria-activedescendant`, so
 * typing only ever filters — nothing is committed until Enter or a click.
 *
 * The list is portalled (via {@link Popover}) rather than laid out under the
 * field because both dialogs that use this put the picker inside a pane that
 * clips its own overflow; an in-flow dropdown would be cut off.
 *
 * @param props - combobox props
 * @param props.id - DOM id for the input, so a `<Label htmlFor>` can name it
 * @param props.channels - the channels available to pick from
 * @param props.value - the selected channel id, or `''` for no selection
 * @param props.onChange - called with the picked channel's id
 * @param props.placeholder - input placeholder while nothing is selected
 * @param props.className - extra classes for the input
 * @returns the rendered channel combobox
 */
export function ChannelCombobox({
  id,
  channels,
  value,
  onChange,
  placeholder = 'Search channels…',
  className
}: {
  id: string;
  channels: ChannelOption[];
  value: string;
  onChange: (channelId: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // What's typed in the field. Only meaningful while the list is open — closed,
  // the input renders the selected channel's label instead (see `inputValue`),
  // so an abandoned search never lingers looking like the selection.
  const [query, setQuery] = useState('');
  // Index into `filtered` that `aria-activedescendant` points at, or -1 when
  // there's nothing to point at (empty list).
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const domId = useId();
  const listboxId = `${domId}-listbox`;
  const optionDomId = (index: number) => `${domId}-option-${index}`;

  const selected = channels.find((c) => c.id === value) ?? null;
  const filtered = useMemo(
    () => (open ? channels.filter((c) => matchesQuery(c.name, query)) : channels),
    [channels, open, query]
  );

  // Closed, the field labels the current selection; open, it's a search box
  // seeded empty so the whole list is reachable without clearing text first.
  const inputValue = open ? query : selected ? channelLabel(selected.name) : '';

  // Keep the active row inside the filtered range as the query narrows it, and
  // start each opening on the selected channel (or the first match) so Enter
  // always has something sensible to commit.
  useEffect(() => {
    if (!open) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => {
      if (prev >= 0 && prev < filtered.length) {
        return prev;
      }
      const selectedIndex = filtered.findIndex((c) => c.id === value);
      return selectedIndex >= 0 ? selectedIndex : filtered.length > 0 ? 0 : -1;
    });
  }, [open, filtered, value]);

  // Follow the active row with the scroll position; arrowing past the fold
  // otherwise moves a highlight the user can't see. Indexed rather than
  // queried by id: `useId` values aren't valid CSS selectors.
  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }
    const row = listRef.current?.querySelectorAll('[role="option"]')[activeIndex];
    // jsdom has no `scrollIntoView`, and it's a nicety either way.
    (row as HTMLElement | undefined)?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  const openList = () => {
    setQuery('');
    setOpen(true);
  };

  const closeList = () => {
    setOpen(false);
    setQuery('');
  };

  const commit = (channel: ChannelOption) => {
    onChange(channel.id);
    closeList();
    inputRef.current?.focus();
  };

  /** Move the active row by `delta`, wrapping, or open the list if it's closed. */
  const moveActive = (delta: number) => {
    if (!open) {
      openList();
      return;
    }
    if (filtered.length === 0) {
      return;
    }
    setActiveIndex((prev) => {
      const next = prev + delta;
      return next < 0 ? filtered.length - 1 : next >= filtered.length ? 0 : next;
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        if (open && filtered.length > 0) {
          e.preventDefault();
          setActiveIndex(0);
        }
        break;
      case 'End':
        if (open && filtered.length > 0) {
          e.preventDefault();
          setActiveIndex(filtered.length - 1);
        }
        break;
      case 'Enter': {
        if (!open) {
          break;
        }
        // Swallowed whenever the list is open, active row or not: Enter belongs
        // to the combobox here, and letting it through would submit the dialog.
        e.preventDefault();
        const active = filtered[activeIndex];
        if (active) {
          commit(active);
        }
        break;
      }
      case 'Escape':
        if (open) {
          // Keep the dialog from closing out from under someone who only meant
          // to dismiss the list.
          e.stopPropagation();
          closeList();
        }
        break;
      case 'Tab':
        if (open) {
          closeList();
        }
        break;
      default:
        break;
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? openList() : closeList())}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={open && activeIndex >= 0 ? optionDomId(activeIndex) : undefined}
            autoComplete="off"
            spellCheck={false}
            value={inputValue}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            // Toggle on click rather than open on focus: `commit` returns focus
            // to the field, and opening on focus would reopen the list the pick
            // just closed.
            onClick={() => (open ? closeList() : openList())}
            className={cn('pr-9', className)}
          />
          <ChevronsUpDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        ref={listRef}
        // Focus stays in the input: this is a combobox, so the active row is
        // announced through `aria-activedescendant` rather than by moving focus.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // A click on the field is the toggle above, not a dismissal — without
        // this, Radix closes on the pointerdown and the click reopens it.
        onInteractOutside={(e) => {
          if (e.target instanceof Node && inputRef.current?.contains(e.target)) {
            e.preventDefault();
          }
        }}
        sideOffset={4}
        // Matches the field's width, and stays inside the viewport on a short
        // screen (the popover's own cap, which this replaces).
        className="max-h-[min(15rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] min-w-48 p-1"
      >
        {/* Not a native <select>: this listbox is owned by the input via
            `aria-controls` and driven by `aria-activedescendant`, which a
            <select> can be neither of. */}
        <div role="listbox" id={listboxId} aria-label="Channels">
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">No channels match that search.</p>
          ) : (
            filtered.map((channel, index) => {
              const isSelected = channel.id === value;
              return (
                // biome-ignore lint/a11y/useFocusableInteractive: options in an aria-activedescendant combobox must stay unfocusable — focus belongs to the input, which is what makes typing filter the list.
                // biome-ignore lint/a11y/useKeyWithClickEvents: the keyboard path lives on that same input, which drives this list via aria-activedescendant.
                <div
                  key={channel.id}
                  id={optionDomId(index)}
                  role="option"
                  aria-selected={isSelected}
                  // Keep focus in the input: a pointerdown here would blur it
                  // and tear the list down before the click ever landed.
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => commit(channel)}
                  onMouseMove={() => setActiveIndex(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-foreground',
                    index === activeIndex && 'bg-accent'
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{channelLabel(channel.name)}</span>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
