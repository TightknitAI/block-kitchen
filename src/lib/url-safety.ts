/**
 * URL-scheme allowlists used as a defense-in-depth layer against
 * DOM-XSS via user-supplied URLs that flow into `<a href>` and `<img src>`
 * in the preview (rendered by `slack-blocks-to-jsx`, which does not
 * filter URI schemes itself) or in the builder's own chrome (e.g. the
 * "Sign in with Slack" link in `SendDialog`).
 *
 * `format: "uri"` on the validator schema (AJV / ajv-formats) accepts
 * any RFC-3986 URI including `javascript:` and `data:`, so the validator
 * cannot be relied on for this purpose.
 *
 * Mirrors react-markdown 9's `defaultUrlTransform` approach: parse the
 * scheme, allow the safe set, and treat anything without a recognized
 * scheme as a relative URL (preserved as-is).
 */

/**
 * Schemes safe to use as an `<a href>` target.
 * Mirrors react-markdown's `safeProtocol` set (`https?|ircs?|mailto|xmpp`)
 * plus `tel` and `sms` (Slack's documented link types).
 */
const SAFE_LINK_PROTOCOLS = /^(https?|ircs?|mailto|tel|sms|xmpp)$/i;

/**
 * Schemes safe to use as an `<img src>` source. We allow `data:image/*`
 * because Slack itself emits inline images that way for some emoji and
 * file thumbnails; everything else (e.g. `data:text/html`, `data:image/svg+xml`
 * — which can carry script in some contexts) is rejected.
 */
const SAFE_IMAGE_PROTOCOLS = /^(https?)$/i;
// Allow `data:image/<safe-mime>` followed by any sequence of media-type
// parameters. Each parameter is `;<name>` or `;<name>=<value>` (RFC 2397
// allows the bare `;base64` token, which has no `=`). The comma
// terminates the parameter list and starts the payload.
const SAFE_IMAGE_DATA_PREFIX =
  /^data:image\/(?:png|jpeg|jpg|gif|webp|avif|x-icon|vnd\.microsoft\.icon)(?:;[a-z0-9-]+(?:=[^,;]*)?)*,/i;

/**
 * Splits a URL into its scheme prefix and tail without invoking the
 * `URL` constructor (which throws on relative URLs and varies in how
 * it normalizes whitespace and unicode). Matches react-markdown's
 * approach: look for the first `:`, `?`, `#`, or `/`; if `:` comes
 * first, that prefix is the scheme.
 * @param value - the candidate URL
 * @returns the lowercase scheme if the URL is absolute, or `null` if relative
 */
function getScheme(value: string): string | null {
  // Strip leading whitespace so `\tjavascript:` and ` javascript:`
  // still resolve to the `javascript` scheme; browsers ignore leading
  // whitespace when following an href, so the sanitizer must too.
  const trimmed = value.replace(/^\s+/, '');
  const colon = trimmed.indexOf(':');
  if (colon === -1) {
    return null;
  }
  const slash = trimmed.indexOf('/');
  const question = trimmed.indexOf('?');
  const hash = trimmed.indexOf('#');
  // If any of `/`, `?`, `#` appears before the `:`, then the `:` is
  // inside the path/query/fragment, not a scheme delimiter — treat the
  // URL as relative.
  if ((slash !== -1 && slash < colon) || (question !== -1 && question < colon) || (hash !== -1 && hash < colon)) {
    return null;
  }
  return trimmed.slice(0, colon).toLowerCase();
}

/**
 * Returns true when `value` is safe to use as an `<a href>` target.
 * Accepts:
 *  - absolute URLs whose scheme is in the safe-link allowlist
 *    (`http`, `https`, `ircs?`, `mailto`, `tel`, `sms`, `xmpp`).
 *  - relative URLs (no scheme).
 *  - empty string (caller decides whether to render).
 *
 * Rejects `javascript:`, `data:`, `vbscript:`, `file:`, `about:`,
 * and any other unrecognized scheme.
 * @param value - the candidate URL
 * @returns true when the URL is safe to render as a link
 */
export function isSafeHref(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value !== 'string') {
    return false;
  }
  if (value.length === 0) {
    return true;
  }
  const scheme = getScheme(value);
  if (scheme === null) {
    return true;
  }
  return SAFE_LINK_PROTOCOLS.test(scheme);
}

/**
 * Returns true when `value` carries an explicit, safe URL scheme
 * (e.g. `https://example.com`, `mailto:a@b.com`).
 *
 * Used to gate the TipTap link extension's autolinker. TipTap's default
 * `shouldAutoLink` links any token containing a dot whose host isn't a
 * bare IPv4 — so `2.xyz`, `report.zip`, or `logo.png` all become links
 * just because the suffix happens to be a real gTLD. Requiring an
 * explicit scheme means only URLs the user actually typed as links
 * (`https://…`) auto-link; bare host-like text stays plain text, and
 * deliberate links can still be added via the link button or by typing
 * the scheme. Schemes outside the safe-link allowlist are rejected here
 * too, so an unsafe scheme can never be auto-linked.
 * @param value - the candidate URL (the linkifier's matched token text)
 * @returns true when the value has an explicit, allowlisted scheme
 */
export function hasExplicitSafeScheme(value: string | null | undefined): boolean {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  return getScheme(value) !== null && isSafeHref(value);
}

/**
 * Returns true when `value` is safe to use as an `<img src>`.
 * Accepts http(s), relative URLs, empty string, and `data:image/*`
 * URLs whose MIME subtype is in a tight allowlist. Rejects
 * `data:image/svg+xml` (can carry script) and everything else.
 * @param value - the candidate URL
 * @returns true when the URL is safe to render as an image
 */
export function isSafeImageSrc(value: string | null | undefined): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value !== 'string') {
    return false;
  }
  if (value.length === 0) {
    return true;
  }
  const scheme = getScheme(value);
  if (scheme === null) {
    return true;
  }
  if (scheme === 'data') {
    return SAFE_IMAGE_DATA_PREFIX.test(value);
  }
  return SAFE_IMAGE_PROTOCOLS.test(scheme);
}

/**
 * Returns `value` if it passes {@link isSafeHref}, otherwise an empty
 * string. Use at render time / payload boundaries so an unsafe URL
 * never reaches the DOM as an `href` attribute.
 * @param value - the candidate URL
 * @returns the URL if safe, or `''`
 */
export function sanitizeHref(value: string | null | undefined): string {
  return isSafeHref(value) ? (value ?? '') : '';
}

/**
 * Returns `value` if it passes {@link isSafeImageSrc}, otherwise an
 * empty string. Use at render time / payload boundaries.
 * @param value - the candidate URL
 * @returns the URL if safe, or `''`
 */
export function sanitizeImageSrc(value: string | null | undefined): string {
  return isSafeImageSrc(value) ? (value ?? '') : '';
}
