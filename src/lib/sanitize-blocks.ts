/**
 * Recursively walks an unknown value and rewrites every URL-bearing
 * string field via the matching sanitizer. Used to strip dangerous URI
 * schemes (e.g. `javascript:`, `data:text/html`) from `url`,
 * `image_url`, `video_url`, rich-text link `url` and friends before a
 * Block Kit payload reaches a renderer or is handed back to the consumer.
 * Also drops the fields no Slack payload should carry: the read-only
 * metadata Slack attaches on retrieval, and the prop bags the renderer
 * would spread verbatim onto a DOM element (see {@link PROP_BAG_KEY}).
 *
 * Allocates a new object whenever a child is rewritten; otherwise
 * returns the input unchanged so unaffected payloads are reference-stable.
 *
 * Defensive against prototype-polluted shapes: copies are made via
 * `Object.assign({}, ...)` over own enumerable keys returned by
 * `Object.keys`, which skips inherited properties.
 */

import type { SupportedBlock } from '../types';
import { sanitizeEmbedSrc, sanitizeHref, sanitizeImageSrc } from './url-safety';

/**
 * Which allowlist applies to a URL-bearing field, by where its value
 * ends up in the DOM: an `<a href>`, an `<img src>`, or a frame /
 * subresource source such as `<iframe src>`.
 */
type UrlKind = 'href' | 'image' | 'embed';

/**
 * Fields whose value the renderer puts in a nested browsing context.
 * `slack-blocks-to-jsx` renders the video block's `video_url` into
 * `<iframe src>`, which loads without a click — so these get the
 * http(s)-only allowlist rather than the link one.
 */
const EMBED_KEYS = new Set(['video_url']);

/**
 * Key names whose value is a URL. Matched on the last `_`-delimited
 * segment so a field added by Slack later (`title_url`,
 * `provider_icon_url`, `author_link`, …) is covered on arrival.
 *
 * This is deliberately a name *shape* rather than an exact-match list:
 * two rounds of URL-sanitizer hardening each shipped with a
 * hand-maintained key set, and each silently missed a field Slack had
 * added. Over-matching is cheap — a key that looks like a URL but holds
 * something else keeps its value, because a string with no recognized
 * scheme is treated as a relative URL and passed through untouched.
 */
const URL_KEY = /(^|_)(url|uri|link|href|src)$/;

/** Cheap pre-filter so the classifier's regexes skip ordinary keys. */
const MAYBE_URL_KEY = /url|uri|link|href|src/i;

/**
 * Name fragments that mark a URL field as an image source. Image
 * sources are allowed to carry a `data:image/<safe-mime>` payload —
 * Slack emits those for some emoji and file thumbnails — which the
 * link allowlist rejects.
 */
const IMAGE_KEY_HINT = /image|thumb|icon|avatar|logo|photo|picture/;

/**
 * Key names whose value the renderer spreads verbatim onto a DOM
 * element. `slack-blocks-to-jsx` reads `iframeProps` off the video block
 * and spreads it onto the `<iframe>` *after* its own `src`, so a payload
 * can override the frame source, add `srcdoc` (an inline document that
 * executes in the embedding app's origin on every React version), or
 * loosen `sandbox` / `allow`. None of that is a Slack field — Slack
 * rejects an unknown property on send — so the whole bag is dropped, at
 * the preview boundary and in `toSlackBlocks` alike. Matched on the last
 * `_`-delimited segment for the same reason URL keys are (see
 * {@link URL_KEY}): a renderer upgrade that adds `imgProps` or
 * `linkProps` is covered on arrival rather than after the next report.
 */
const PROP_BAG_KEY = /(^|_)props$/;

/**
 * Folds camelCase to snake_case and lowercases, so a consumer payload
 * that isn't strict Slack JSON (`videoUrl`, `iframeProps`) classifies
 * the same way as its snake_case form.
 * @param key - the payload object's key
 * @returns the normalized key
 */
function normalizeKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Returns true when `key` names a prop bag the renderer would spread
 * onto a DOM element, so the key and its value must be dropped. See
 * {@link PROP_BAG_KEY}.
 * @param key - the payload object's key
 * @returns whether the key is a renderer-only prop bag
 */
function isRendererPropBag(key: string): boolean {
  return PROP_BAG_KEY.test(normalizeKey(key));
}

/**
 * Classifies a payload key by the kind of URL it carries, or `null`
 * when the key holds no URL at all.
 * @param key - the payload object's key
 * @returns which allowlist applies, or `null` to leave the value alone
 */
function classifyUrlKey(key: string): UrlKind | null {
  if (!MAYBE_URL_KEY.test(key)) {
    return null;
  }
  const normalized = normalizeKey(key);
  if (EMBED_KEYS.has(normalized)) {
    return 'embed';
  }
  if (!URL_KEY.test(normalized)) {
    return null;
  }
  return IMAGE_KEY_HINT.test(normalized) ? 'image' : 'href';
}

/**
 * Read-only metadata Slack attaches when a message is *retrieved* via the
 * API, but rejects on *send*, keyed by the `type` of the object it appears
 * on. Blocks loaded from an existing message carry these; drop them only
 * from the matching object type — some are common field names (`fallback`)
 * that are valid elsewhere — so a round-tripped payload stays send-valid
 * without over-scrubbing. Add an entry to extend this to other block types.
 */
const RETRIEVAL_ONLY_KEYS = new Map<string, Set<string>>([
  // Covers both the image block and the image element — both `type: 'image'`.
  ['image', new Set(['image_width', 'image_height', 'image_bytes', 'fallback', 'is_animated'])],
  // Slack renders the chart server-side and attaches the rendered previews on
  // retrieval; sending them back is rejected as `unknown property 'preview_images'`.
  ['data_visualization', new Set(['preview_images'])]
]);

/**
 * Recursively sanitize every URL-bearing string field inside a Slack
 * Block Kit payload fragment. Returns a value with the same structural
 * shape, where any field whose name reads as a URL has been replaced by
 * the safe variant (`''` if the original scheme was unsafe for the kind
 * of URL that field carries — see {@link classifyUrlKey}), and where the
 * retrieval-only and renderer-only keys have been dropped.
 * @param value - any payload fragment (object, array, primitive)
 * @returns the sanitized payload fragment
 */
function sanitizeValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const next = sanitizeValue(value[i]);
      if (next !== value[i]) {
        changed = true;
      }
      out[i] = next;
    }
    return changed ? out : value;
  }
  const src = value as Record<string, unknown>;
  const dropKeys = typeof src.type === 'string' ? RETRIEVAL_ONLY_KEYS.get(src.type) : undefined;
  let copy: Record<string, unknown> | null = null;
  for (const key of Object.keys(src)) {
    if (dropKeys?.has(key) || isRendererPropBag(key)) {
      copy ??= { ...src };
      delete copy[key];
      continue;
    }
    const original = src[key];
    let next: unknown = original;
    if (typeof original === 'string') {
      const kind = classifyUrlKey(key);
      if (kind === 'href') {
        next = sanitizeHref(original);
      } else if (kind === 'image') {
        next = sanitizeImageSrc(original);
      } else if (kind === 'embed') {
        next = sanitizeEmbedSrc(original);
      }
    } else if (typeof original === 'object' && original !== null) {
      next = sanitizeValue(original);
    }
    if (next !== original) {
      if (!copy) {
        copy = { ...src };
      }
      copy[key] = next;
    }
  }
  return copy ?? src;
}

/**
 * Sanitize a single Block Kit block, scrubbing dangerous URI schemes
 * from every URL-bearing field anywhere in the payload tree (`url`,
 * `image_url`, `video_url`, `thumbnail_url`, `title_url`, …) and dropping
 * the renderer-only prop bags (`iframeProps`) a payload could use to
 * reach the DOM around that scrub.
 * @param block - the block payload to sanitize
 * @returns the sanitized block (same reference if nothing changed)
 */
export function sanitizeBlock<T extends SupportedBlock>(block: T): T {
  return sanitizeValue(block) as T;
}

/**
 * Sanitize an array of Block Kit blocks. See {@link sanitizeBlock}.
 * @param blocks - the block payloads to sanitize
 * @returns the sanitized blocks
 */
export function sanitizeBlocks(blocks: SupportedBlock[]): SupportedBlock[] {
  let changed = false;
  const out = new Array<SupportedBlock>(blocks.length);
  for (let i = 0; i < blocks.length; i++) {
    const next = sanitizeBlock(blocks[i]);
    if (next !== blocks[i]) {
      changed = true;
    }
    out[i] = next;
  }
  return changed ? out : blocks;
}
