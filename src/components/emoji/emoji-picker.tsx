import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import {
  codepointsToGlyph,
  type EmojiDatum,
  type EmojiIndex,
  loadEmojiIndex,
  unifiedToUnicode
} from '../../lib/emoji-data';
import { pushEmojiRecent, readEmojiRecents, readEmojiSkinTone, writeEmojiSkinTone } from '../../lib/emoji-recents';
import { Input } from '../../lib/ui/input';
import { useCustomEmojis } from '../../state/custom-emoji-context';
import type { CustomEmoji } from '../../types';

/**
 * A resolved emoji selection emitted by {@link EmojiPicker}. The codename
 * (`name`) is always a Slack codename resolved via the Unicode codepoint, so
 * it round-trips to Slack without becoming blank text. `unicode` / `src` are
 * render-only hints; `skinTone` is Slack's 2–6 (or null for default / custom).
 */
export interface EmojiSelection {
  name: string;
  unicode: string | null;
  src: string | null;
  skinTone: number | null;
}

/** The five skin tones offered, mapped to Slack `skin_tone` (2–6). */
const SKIN_TONES = [
  { tone: null, label: 'Default', swatch: '✋' },
  { tone: 2, label: 'Light', swatch: '✋🏻' },
  { tone: 3, label: 'Medium-light', swatch: '✋🏼' },
  { tone: 4, label: 'Medium', swatch: '✋🏽' },
  { tone: 5, label: 'Medium-dark', swatch: '✋🏾' },
  { tone: 6, label: 'Dark', swatch: '✋🏿' }
] as const;

/** One renderable entry in a picker section: either a standard or custom emoji. */
type PickerEntry = { datum?: EmojiDatum; custom?: CustomEmoji };

interface PickerSection {
  key: string;
  title: string;
  emoji: PickerEntry[];
}

/**
 * Searchable Slack-style emoji picker covering the standard set (sourced from
 * `emoji-datasource`) plus workspace custom emoji. Offers search, categories,
 * skin tone, and a recents row. On pick it emits {@link EmojiSelection} with a
 * Slack codename resolved via codepoint — never the composed shortcode.
 *
 * @param props.onSelect - called with the resolved selection when an emoji is picked
 * @param props.autoFocus - whether to focus the search input on mount (default true)
 */
export function EmojiPicker({
  onSelect,
  autoFocus = true
}: {
  onSelect: (selection: EmojiSelection) => void;
  autoFocus?: boolean;
}) {
  const { customEmojis } = useCustomEmojis();
  const [index, setIndex] = useState<EmojiIndex | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState('');
  const [skinTone, setSkinTone] = useState<number | null>(() => readEmojiSkinTone());
  const [recents, setRecents] = useState<string[]>(() => readEmojiRecents());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    loadEmojiIndex()
      .then((idx) => {
        if (active) {
          setIndex(idx);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (autoFocus) {
      searchRef.current?.focus();
    }
  }, [autoFocus]);

  // Workspace custom emoji that render as an image form the "Custom" category.
  const customByName = useMemo(() => {
    const map = new Map<string, CustomEmoji>();
    for (const e of customEmojis) {
      map.set(e.name, e);
    }
    return map;
  }, [customEmojis]);
  const customImageEmoji = useMemo(() => customEmojis.filter((e) => e.url), [customEmojis]);

  const handlePick = (selection: EmojiSelection) => {
    setRecents(pushEmojiRecent(selection.name));
    onSelect(selection);
  };

  const handleSkinTone = (tone: number | null) => {
    setSkinTone(tone);
    writeEmojiSkinTone(tone);
  };

  const sections = useMemo<PickerSection[]>(() => {
    if (!index) {
      return [];
    }
    const trimmed = query.trim().toLowerCase();
    if (trimmed) {
      const standard = index.all
        .filter((d) => d.shortNames.some((sn) => sn.includes(trimmed)))
        .slice(0, 120)
        .map((datum) => ({ datum }));
      const custom = customImageEmoji
        .filter((e) => e.name.toLowerCase().includes(trimmed))
        .map((custom) => ({ custom }));
      return [{ key: 'search', title: 'Search results', emoji: [...custom, ...standard] }];
    }

    const out: PickerSection[] = [];
    if (recents.length > 0) {
      const recentEmoji = recents
        .map((name): PickerEntry | null => {
          const custom = customByName.get(name);
          if (custom?.url) {
            return { custom };
          }
          const datum = index.byName.get(name);
          return datum ? { datum } : null;
        })
        .filter((e): e is PickerEntry => e !== null);
      if (recentEmoji.length > 0) {
        out.push({ key: 'recents', title: 'Frequently used', emoji: recentEmoji });
      }
    }
    if (customImageEmoji.length > 0) {
      out.push({ key: 'custom', title: 'Custom', emoji: customImageEmoji.map((custom) => ({ custom })) });
    }
    for (const group of index.byCategory) {
      out.push({ key: group.category, title: group.category, emoji: group.emoji.map((datum) => ({ datum })) });
    }
    return out;
  }, [index, query, recents, customByName, customImageEmoji]);

  return (
    <div className="bk-emoji-picker flex w-[320px] max-w-[90vw] flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          ref={searchRef}
          value={query}
          placeholder="Search emoji…"
          aria-label="Search emoji"
          onChange={(e) => setQuery(e.target.value)}
          className="h-8"
        />
        <SkinToneSelector value={skinTone} onChange={handleSkinTone} />
      </div>
      <div className="h-64 overflow-y-auto pr-1">
        {loadError ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Couldn't load emoji.</p>
        ) : !index ? (
          <p className="p-4 text-center text-xs text-muted-foreground">Loading emoji…</p>
        ) : sections.every((s) => s.emoji.length === 0) ? (
          <p className="p-4 text-center text-xs text-muted-foreground">No emoji found.</p>
        ) : (
          sections.map((section) => (
            <div key={section.key} className="mb-2">
              <div className="sticky top-0 z-10 bg-background px-1 py-1 text-[11px] font-medium text-muted-foreground">
                {section.title}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {section.emoji.map((entry, i) =>
                  entry.custom ? (
                    <CustomEmojiButton
                      key={`${section.key}-${entry.custom.name}-${i}`}
                      emoji={entry.custom}
                      onPick={handlePick}
                    />
                  ) : entry.datum ? (
                    <StandardEmojiButton
                      key={`${section.key}-${entry.datum.name}-${i}`}
                      datum={entry.datum}
                      skinTone={skinTone}
                      onPick={handlePick}
                    />
                  ) : null
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Resolves a standard emoji datum + the active skin tone to an
 * {@link EmojiSelection}, applying the tone only when the emoji supports it.
 */
function resolveStandard(datum: EmojiDatum, skinTone: number | null): EmojiSelection {
  const tonedUnified = skinTone ? datum.skinUnified[skinTone] : undefined;
  return {
    name: datum.name,
    unicode: unifiedToUnicode(tonedUnified ?? datum.unified),
    src: null,
    skinTone: tonedUnified ? skinTone : null
  };
}

const emojiButtonClass =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded text-lg leading-none hover:bg-accent';

/** A single standard emoji button. */
function StandardEmojiButton({
  datum,
  skinTone,
  onPick
}: {
  datum: EmojiDatum;
  skinTone: number | null;
  onPick: (s: EmojiSelection) => void;
}) {
  const tonedUnified = (skinTone && datum.skinUnified[skinTone]) || datum.unified;
  return (
    <button
      type="button"
      className={emojiButtonClass}
      title={`:${datum.name}:`}
      aria-label={datum.name}
      onClick={() => onPick(resolveStandard(datum, skinTone))}
    >
      {codepointsToGlyph(tonedUnified)}
    </button>
  );
}

/** A single workspace custom emoji button (image). */
function CustomEmojiButton({ emoji, onPick }: { emoji: CustomEmoji; onPick: (s: EmojiSelection) => void }) {
  return (
    <button
      type="button"
      className={emojiButtonClass}
      title={`:${emoji.name}:`}
      aria-label={emoji.name}
      onClick={() => onPick({ name: emoji.name, unicode: null, src: emoji.url, skinTone: null })}
    >
      {emoji.url ? (
        <img src={emoji.url} alt={`:${emoji.name}:`} className="h-5 w-5 object-contain" />
      ) : (
        <span className="text-[10px]">:{emoji.name}:</span>
      )}
    </button>
  );
}

/** Row of skin-tone swatches; the active tone applies to standard emoji. */
function SkinToneSelector({ value, onChange }: { value: number | null; onChange: (tone: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const active = SKIN_TONES.find((t) => t.tone === value) ?? SKIN_TONES[0];
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label={`Skin tone: ${active.label}`}
        title={`Skin tone: ${active.label}`}
        className="flex h-8 w-8 items-center justify-center rounded border text-lg leading-none hover:bg-accent"
        onClick={() => setOpen((o) => !o)}
      >
        {active.swatch}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 flex gap-0.5 rounded-md border bg-background p-1 shadow-md">
          {SKIN_TONES.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-label={t.label}
              title={t.label}
              className={cn(emojiButtonClass, value === t.tone && 'bg-accent')}
              onClick={() => {
                onChange(t.tone);
                setOpen(false);
              }}
            >
              {t.swatch}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
