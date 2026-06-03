/**
 * Emoji dataset built from `emoji-datasource` (iamcal / `emoji-data`) — the
 * same canonical source `@tightknit/emoji-mapping` is generated from. Its
 * `short_name` values are Slack's codenames, so resolving a picked emoji to a
 * Slack `name` via its Unicode codepoint (`unified`) is immune to alias drift.
 *
 * The raw dataset (~1.3 MB JSON) is loaded lazily via dynamic import so it
 * never bloats the initial bundle — only when an emoji picker first mounts.
 * The derived index is memoized after the first load.
 */

/** A raw record from `emoji-datasource`'s `emoji.json` (subset we use). */
export interface RawEmoji {
  name: string | null;
  unified: string;
  short_name: string;
  short_names: string[];
  category: string;
  sort_order: number;
  skin_variations?: Record<string, { unified: string }>;
}

/** A normalized emoji entry used by the picker and the TipTap converter. */
export interface EmojiDatum {
  /** Canonical Slack codename (first `short_name`). */
  name: string;
  /** All Slack codenames for this codepoint (used for search + lookup). */
  shortNames: string[];
  /** Base Unicode codepoint(s), uppercase, hyphen-delimited (`1F44B`). */
  unified: string;
  /** Source category name (`Smileys & Emotion`, …). */
  category: string;
  /** Stable ordering within a category. */
  sortOrder: number;
  /**
   * Per-skin-tone base+tone codepoints, keyed by Slack `skin_tone` (2–6).
   * Empty when the emoji has no skin variations.
   */
  skinUnified: Record<number, string>;
}

/** The memoized, derived index the picker and converter consume. */
export interface EmojiIndex {
  /** All standard emoji, in category + sort order. */
  all: EmojiDatum[];
  /** Lookup by any Slack codename. */
  byName: Map<string, EmojiDatum>;
  /** Lookup by base `unified` codepoint(s) (uppercase). */
  byUnified: Map<string, EmojiDatum>;
  /** Category name → entries, in Slack-like display order. */
  byCategory: { category: string; emoji: EmojiDatum[] }[];
}

/**
 * The five Fitzpatrick skin-tone modifier codepoints, in order, mapped to
 * Slack's `skin_tone` integer. emoji-mart's `skin` is 1 (default, no tone) or
 * 2–6; Slack's `skin_tone` uses the same 2–6 and omits the field for default.
 */
const TONE_CODEPOINT_TO_SKIN_TONE: Record<string, number> = {
  '1F3FB': 2,
  '1F3FC': 3,
  '1F3FD': 4,
  '1F3FE': 5,
  '1F3FF': 6
};

/**
 * Slack-like category display order. `Component` (skin-tone modifiers, etc.)
 * is intentionally omitted — those aren't user-pickable emoji.
 */
const CATEGORY_ORDER = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags'
];

/**
 * Converts a hyphen-delimited Unicode codepoint string (`1F44B`,
 * `1F441-FE0F`) to its rendered glyph. Invalid codepoints are skipped.
 * @param unified - uppercase hyphen-delimited codepoints
 * @returns the rendered emoji glyph
 */
export function codepointsToGlyph(unified: string): string {
  return unified
    .split('-')
    .map((cp) => {
      const n = Number.parseInt(cp, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : '';
    })
    .join('');
}

/**
 * The Slack rich_text `unicode` value for an emoji: the base codepoint(s),
 * lowercased (`1F44B` → `1f44b`). Skin tone is carried separately in
 * `skin_tone`, never folded into `unicode`.
 * @param unified - the base `unified` codepoint(s)
 * @returns the lowercased codepoint string
 */
export function unifiedToUnicode(unified: string): string {
  return unified.toLowerCase();
}

/**
 * Composes the text form of an emoji for plain_text / mrkdwn fields:
 * `:name:` or, with a skin tone, `:name::skin-tone-N:`.
 * @param name - the Slack codename (no colons)
 * @param skinTone - optional Slack `skin_tone` (2–6)
 * @returns the colon-wrapped shortcode
 */
export function composeTextEmoji(name: string, skinTone?: number): string {
  if (skinTone && skinTone >= 2 && skinTone <= 6) {
    return `:${name}::skin-tone-${skinTone}:`;
  }
  return `:${name}:`;
}

/**
 * Builds the derived {@link EmojiIndex} from raw `emoji-datasource` records.
 * Pure and synchronous so it can be unit-tested with a small fixture.
 * @param raw - the raw emoji records
 * @returns the normalized, ordered index
 */
export function buildEmojiIndex(raw: RawEmoji[]): EmojiIndex {
  const all: EmojiDatum[] = [];
  const byName = new Map<string, EmojiDatum>();
  const byUnified = new Map<string, EmojiDatum>();

  for (const r of raw) {
    if (!CATEGORY_ORDER.includes(r.category)) {
      continue;
    }
    const shortNames = r.short_names?.length ? r.short_names : [r.short_name];
    const skinUnified: Record<number, string> = {};
    if (r.skin_variations) {
      for (const [toneKey, variation] of Object.entries(r.skin_variations)) {
        const skinTone = TONE_CODEPOINT_TO_SKIN_TONE[toneKey];
        // Skip compound (multi-person) variations keyed by paired tones; we
        // only model a single skin_tone, matching Slack's emoji element.
        if (skinTone && variation?.unified) {
          skinUnified[skinTone] = variation.unified;
        }
      }
    }
    const datum: EmojiDatum = {
      name: shortNames[0],
      shortNames,
      unified: r.unified,
      category: r.category,
      sortOrder: r.sort_order,
      skinUnified
    };
    all.push(datum);
    byUnified.set(r.unified.toUpperCase(), datum);
    for (const sn of shortNames) {
      // First writer wins so the canonical record owns a shared codename.
      if (!byName.has(sn)) {
        byName.set(sn, datum);
      }
    }
  }

  all.sort((a, b) => a.sortOrder - b.sortOrder);

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    emoji: all.filter((e) => e.category === category)
  })).filter((group) => group.emoji.length > 0);

  return { all, byName, byUnified, byCategory };
}

let indexPromise: Promise<EmojiIndex> | null = null;
let cachedIndex: EmojiIndex | null = null;

/**
 * Lazily loads `emoji-datasource` and builds the {@link EmojiIndex}, memoizing
 * the result across calls. Safe to call repeatedly; the dynamic import and
 * index build happen at most once.
 * @returns the emoji index
 */
export async function loadEmojiIndex(): Promise<EmojiIndex> {
  if (cachedIndex) {
    return cachedIndex;
  }
  if (!indexPromise) {
    indexPromise = import('emoji-datasource/emoji.json')
      .then((mod) => {
        const raw = (mod.default ?? mod) as RawEmoji[];
        cachedIndex = buildEmojiIndex(raw);
        return cachedIndex;
      })
      .catch((err) => {
        // Reset so a transient failure can be retried on the next open.
        indexPromise = null;
        throw err;
      });
  }
  return indexPromise;
}

/**
 * Returns the already-loaded index, or `null` if it hasn't loaded yet. Used by
 * synchronous code paths (e.g. the TipTap import converter) that resolve emoji
 * metadata best-effort and degrade gracefully when the dataset isn't warm.
 * @returns the cached index or null
 */
export function getEmojiIndex(): EmojiIndex | null {
  return cachedIndex;
}
