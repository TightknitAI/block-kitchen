# Security review — `@tightknitai/block-kitchen` v0.5.2-alpha.0

Date: 2026-05-16
Reviewer: pre-publish hardening pass before the next release.
Methodology: OWASP-aligned code review of `src/`, direct inspection of
the runtime behavior of every third-party renderer in `node_modules`
(`slack-blocks-to-jsx@1.0.4`, `@tiptap/extension-link@3.23.4`,
`react-markdown@9.1.0`, `@tightknitai/slack-block-kit-validator@0.1.0-alpha.0`),
and unit-test proof-of-concepts for each finding. `pnpm audit` clean.

## Executive summary

| Severity | Count | Status |
| -------- | ----- | ------ |
| Critical | 0     | —      |
| High     | 1     | Fixed in this PR. |
| Medium   | 4     | Fixed in this PR. |
| Low      | 3     | Fixed in this PR. |
| Info     | 4     | Documented; no code change required. |

The single highest-impact issue is **stored DOM-XSS via crafted Block
Kit JSON**: user-supplied URLs (rich-text link `url`, section / card /
button `url`, `image_url`) were stored raw and passed to
`slack-blocks-to-jsx`'s `<a href>` and `<img src>` renderers without
URI-scheme filtering. A payload containing `javascript:alert(...)` —
deliverable via the JSON drawer, a shareable encoded URL state, or a
consumer's own backend — became a clickable script gadget in the
preview, executing in the consumer's origin. The validator
(`format: "uri"`) accepts any RFC-3986 URI and is not a defense.

This PR adds a single shared allowlist (`src/lib/url-safety.ts`) and
wires it into:

- the preview boundary (`SlackBlockPreview` sanitizes every block
  before handing it to `<Message>`),
- the public `toSlackBlocks` (sanitizes payloads on the way out to the
  Slack API or any consumer),
- the TipTap link extension config (`isAllowedUri` and `protocols`),
- the structured rich-text editor's URL field (visible warning),
- `SendDialog`'s "Sign in with Slack" link (refuses to render an
  unsafe `oauthUrl`),
- `proseMirrorToRichText` (drops unsafe URLs at serialization).

It also adds size guards (1 MiB) on the URL-state codec and JSON drawer
to prevent UI freezes on pathological inputs, tightens the Dependabot
auto-merge workflow to exclude security-sensitive packages, and trims
the publish workflow so the npm-token-bearing job no longer reinstalls
Chromium.

206 tests pass, lint clean, typecheck clean.

---

## Findings

### F-001 (High) — Stored DOM-XSS via unsanitized URLs in Block Kit payloads

- **OWASP**: A03 Injection (DOM-XSS).
- **Surfaces**: [src/components/preview/slack-block-preview.tsx](src/components/preview/slack-block-preview.tsx), every editor that accepts a URL ([image-editor.tsx:30](src/components/editors/image-editor.tsx:30), [section-editor.tsx:192,259](src/components/editors/section-editor.tsx:192), [context-editor.tsx:244](src/components/editors/context-editor.tsx:244), [card-editor.tsx:152,249](src/components/editors/card-editor.tsx:152), [rich-text-structured-editor.tsx:462](src/components/editors/rich-text-structured-editor.tsx:462)), the public [`decodeBlocksFromString`](src/lib/url-state.ts) API.
- **Root cause**: `slack-blocks-to-jsx@1.0.4` renders non-mrkdwn URLs into `<a href={url}>` directly — there are 10 distinct anchor construction sites and 6 image construction sites in its bundle, none of which filter URI schemes. The Slack validator (`format: "uri"`, AJV) accepts any RFC-3986 URI, including `javascript:`.
- **Repro**:
  ```jsonc
  // Paste into the JSON drawer, or encode via encodeBlocksToString and
  // ship in a URL hash, or return from any consumer-controlled flow.
  [
    {
      "type": "rich_text",
      "elements": [
        {
          "type": "rich_text_section",
          "elements": [
            { "type": "link", "url": "javascript:alert(document.cookie)", "text": "click me" }
          ]
        }
      ]
    }
  ]
  ```
  Before this PR: the preview rendered `<a href="javascript:alert(document.cookie)">click me</a>`, which fired on click in the consumer's origin.
- **Note on mrkdwn**: `react-markdown@9.1.0` does block `javascript:` via `defaultUrlTransform`, but `slack-blocks-to-jsx@1.0.4` does NOT route `section.text.mrkdwn` through react-markdown — it ships its own inline mrkdwn parser that extracts `[label](url)` and `<url|label>` links and hands `url` straight to `<a href={url}>` without filtering. The same applies to `mrkdwn` text in headers, contexts, cards, etc. In practice, React 19's runtime `javascript:`-URL mitigation kept these attacks from firing (it replaces the href with `javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`), but the URL still reached the DOM, the consumer is not guaranteed to be on React ≥ 16.9 (peerDep allows ^18), and an attacker could still exploit non-`javascript:` unsafe schemes (`data:text/html`, `vbscript:`, `file:`) which React does NOT block. The post-render DOM scrub closes this hole.
- **Note on TipTap**: `@tiptap/extension-link@3.23.4` already gates `setLink` / `toggleLink` on `isAllowedUri` (default allowlist: http/https/ftp/ftps/mailto/tel/callto/sms/cid/xmpp), so the WYSIWYG entry path was safe. But the **structured** editor's URL field bypassed TipTap entirely, and a crafted payload imported from JSON or URL state never went through `setLink`.
- **Fix**:
  - New module [src/lib/url-safety.ts](src/lib/url-safety.ts) exports `isSafeHref` / `isSafeImageSrc` / `sanitizeHref` / `sanitizeImageSrc`. Mirrors react-markdown's `defaultUrlTransform` shape; allowlist matches Slack's documented link types (`http`/`https`/`mailto`/`tel`/`sms`/`xmpp`/`ircs?`).
  - New module [src/lib/sanitize-blocks.ts](src/lib/sanitize-blocks.ts) walks a block tree and rewrites every `url`/`image_url` field through the allowlist.
  - [src/components/preview/slack-block-preview.tsx](src/components/preview/slack-block-preview.tsx) memo-sanitizes the block before handing it to `<Message>` AND runs a post-render DOM walk that scrubs `<a href>` and `<img src>` produced by the renderer's own mrkdwn parser (which extracts link URLs from `[label](url)` and `<url|label>` syntax inside `text` strings — those URLs do not live in a structured `url` key and so are missed by the payload-level pass). This is the load-bearing belt-and-suspenders fix; the rest of this finding's mitigations layer on top.
  - [src/lib/to-slack-blocks.ts](src/lib/to-slack-blocks.ts) sanitizes on the way OUT, so the public API consumer also cannot inadvertently ship `javascript:` to Slack.
  - [src/components/editors/rich-text-editor.tsx](src/components/editors/rich-text-editor.tsx): explicit `protocols` allowlist and an `isAllowedUri` hook bound to `isSafeHref`; popover Apply validates and shows an inline error.
  - [src/lib/rich-text-tiptap.ts](src/lib/rich-text-tiptap.ts): `proseMirrorToRichText` sanitizes link `url` before emitting the Slack payload, so a payload imported via `setContent` cannot round-trip out unchanged.
  - [src/components/editors/rich-text-structured-editor.tsx](src/components/editors/rich-text-structured-editor.tsx): URL field flags unsafe input with `aria-invalid` and an inline warning ("will be stripped before send and preview").
- **Tests**: [test/url-safety.test.ts](test/url-safety.test.ts), [test/sanitize-blocks.test.ts](test/sanitize-blocks.test.ts), and the new `toSlackBlocks URL sanitization` block in [test/public-api.test.ts](test/public-api.test.ts) cover the safe / unsafe matrix and the reference-stability invariant.
- **End-to-end verification**: pasted a payload mixing `[click](javascript:...)`, `<javascript:...|label>`, a rich_text `link.url` of `javascript:...`, a `data:image/svg+xml,<svg onload=alert(1)>` image, and safe controls into the demo's JSON drawer. Result: all four anchors carrying a `javascript:` URL ended up with `href="#"` and a `data-bk-blocked-href="1"` marker (mrkdwn path) or empty `href` (rich-text payload path), the SVG image's `src` was removed, and the `https://` controls passed through unchanged. Screenshot in the PR.

### F-002 (Medium) — `userStatus.oauthUrl` rendered without URI-scheme validation

- **OWASP**: A03 Injection (DOM-XSS at a consumer-trust boundary).
- **Location**: [src/components/send-dialog.tsx:196](src/components/send-dialog.tsx:196) (before fix).
- **Root cause**: `userStatus.oauthUrl` is the unfiltered return value of the consumer's `loadSendAsUserStatus` callback and was rendered into `<a href={userStatus.oauthUrl} target="_blank" rel="noreferrer">`. If a downstream backend was ever compromised, MITM'd, or simply buggy, returning `javascript:...` would execute on click. Also missing explicit `noopener`.
- **Fix**: Gate the entire `<p>` on `isSafeHref(userStatus.oauthUrl)`; upgrade `rel="noreferrer"` to `rel="noopener noreferrer"`.
- **Residual risk**: the consumer can still display a misleading OAuth URL pointing to a non-Slack origin (open-redirect-flavoured phishing). That's a consumer-side decision; we now refuse only the URI-scheme attack.

### F-003 (Medium) — TipTap link extension had no explicit `protocols` / `isAllowedUri`

- **OWASP**: A05 Security Misconfiguration / A04 Insecure Design.
- **Location**: [src/components/editors/rich-text-editor.tsx:99-110](src/components/editors/rich-text-editor.tsx:99) (before fix).
- **Root cause**: relied on `@tiptap/extension-link`'s defaults. The default allowlist is wider than we need (`http/https/ftp/ftps/mailto/tel/callto/sms/cid/xmpp`) and could silently widen further on a minor upgrade.
- **Fix**: explicit `protocols: ['http','https','mailto','tel','sms','xmpp']` plus `isAllowedUri: (url) => isSafeHref(url)`. The popover Apply handler also pre-validates and shows an inline error, so the user sees why the link did not stick.

### F-004 (Medium) — No size guard on `decodeBlocksFromString` input

- **OWASP**: A05 Security Misconfiguration (client-side DoS).
- **Location**: [src/lib/url-state.ts:31](src/lib/url-state.ts:31) (before fix).
- **Root cause**: a hostile-or-buggy URL hash could feed an arbitrarily large base64url string into `atob` + `JSON.parse`, hanging the tab before the validator gets a look.
- **Fix**: a 1 MiB cap (`MAX_ENCODED_BYTES`) returns `null` immediately on oversized input. Realistic Slack Block Kit payloads sit well under 100 KiB; the cap is generous enough that legitimate consumers will never hit it.
- **Test**: `test/public-api.test.ts` — `rejects encoded input larger than 1 MiB without invoking atob`.

### F-005 (Medium) — No size guard on the JSON drawer textarea

- **OWASP**: A05 Security Misconfiguration (client-side DoS).
- **Location**: [src/components/json-drawer.tsx:60](src/components/json-drawer.tsx:60) (before fix).
- **Root cause**: `JSON.parse` on a multi-megabyte paste froze the UI thread.
- **Fix**: a 1 MiB cap surfaces a clear inline error ("JSON exceeds the 1024 KiB editor limit.") before `JSON.parse` runs.

### F-006 (Low) — Dependabot auto-merges security-sensitive packages

- **OWASP**: A08 Software & Data Integrity (supply chain).
- **Location**: [.github/workflows/dependabot-automerge.yml](.github/workflows/dependabot-automerge.yml) (before fix).
- **Root cause**: any non-major Dependabot PR auto-approved and auto-merged after CI passed, including direct deps that render user content (`slack-blocks-to-jsx`, `react-markdown`, `remark-gfm`, every `@tiptap/*`, `ajv`, the validator). A single compromised minor release ships to consumers within minutes (cf. `event-stream`, `colors.js`, `node-ipc`, `peacenotwar`).
- **Fix**: an exclusion list checked from Dependabot metadata. Updates to any of the renderer / validator / Tiptap / markdown deps now post a "held for manual review" comment and require a human to merge.
- **Update (2026-09)**: the gate was tightened further. Auto-merge is now limited to direct devDependencies (`dependency-type == direct:development`). Every production dependency is held for review regardless of semver level, because release-please publishes those to npm consumers with no further human checkpoint on the dependency diff. Dependabot reports GitHub Actions bumps as production and lockfile-only updates as `indirect`, so both are held as well. The exclusion list remains as defense in depth for packages that render user content even when they appear as devDependencies.

### F-007 (Low) — Publish workflow re-runs full test suite with Playwright

- **OWASP**: A08 Software & Data Integrity (supply chain).
- **Location**: [.github/workflows/publish.yml](.github/workflows/publish.yml) (before fix).
- **Root cause**: the `publish` job — which holds `NPM_TOKEN` — re-installed Chromium and re-ran the entire Playwright-backed Vitest suite before `pnpm publish`. Every additional install on the token-bearing job is supply-chain surface area for nothing: the same tests already ran in CI against the same commit before release-please merged it to main.
- **Fix**: publish runs lint + typecheck + build only. The verbose comment explains why.

### F-008 (Low) — Send-dialog OAuth link had `rel="noreferrer"` only

- **OWASP**: A05 Security Misconfiguration.
- **Location**: [src/components/send-dialog.tsx:196](src/components/send-dialog.tsx:196) (before fix).
- **Root cause**: `rel="noreferrer"` implies `noopener` in modern browsers but not in all older ones. Defense-in-depth says set both.
- **Fix**: upgraded to `rel="noopener noreferrer"` (combined with F-002).

---

## Follow-up findings

Reported after the review above, against the same code. Kept here so the
URL-sanitization story reads in one place.

### F-009 (High) — Video-block URL fields bypassed the F-001 sanitizer and reached an unsanitized `<iframe src>`

- **Reported**: 2026-08-27, external report. **Fixed**: 2026-09-01.
- **OWASP**: A03 Injection (DOM-XSS).
- **Surfaces**: the same entry points as F-001 — JSON drawer, `decodeBlocksFromString` / the `?blocks=` URL state, `initialBlocks`, `onLoadMessage`, any consumer backend.
- **Root cause**: all three F-001 layers were scoped to the URL fields that existed when they were written, and the video block's four are not among them.
  1. The payload sanitizer keyed on exact-match sets `HREF_KEYS = {'url'}` / `IMAGE_KEYS = {'image_url'}`, so `video_url`, `title_url`, `thumbnail_url`, and `provider_icon_url` were returned verbatim — by `sanitizeBlock` at the preview boundary **and** by `toSlackBlocks`, the documented consumer hardening boundary.
  2. `slack-blocks-to-jsx@1.1.2` renders `<iframe title={alt_text} src={video_url}>` with no scheme filter, the same gap F-001 documented for its anchors and images.
  3. The post-render DOM scrub walked `a[href]` and `img[src]` only. `iframe[src]` was never inspected.
- **Repro**: paste into the JSON drawer — the preview rendered `<iframe src="data:text/html,…">` with no `data-bk-blocked-*` marker, while the same block's `title_url` anchor *was* scrubbed to `href="#"` (the control proving layer 3 worked for anchors and not for frames).
  ```jsonc
  [
    {
      "type": "video",
      "alt_text": "poc",
      "title": { "type": "plain_text", "text": "PoC" },
      "thumbnail_url": "https://example.com/t.png",
      "video_url": "data:text/html,<script>top.__pwned=1</script>",
      "block_id": "poc"
    }
  ]
  ```
- **Impact**: a `javascript:` `video_url` executes in the embedding app's origin on React 18 (an explicitly supported peer). React 19 blocks that one at `setAttribute` time, but `data:text/html` renders and executes on **every** React version — in an opaque origin, so phishing and UI-redress inside trusted chrome rather than token theft. Reproduced in jsdom: the frame navigation fires before any of our code runs.
- **Fix**:
  - `src/lib/url-safety.ts`: new `isSafeEmbedSrc` / `sanitizeEmbedSrc`. Tighter than both existing predicates — http(s) only. `data:` of any media type is rejected (a frame loads with no click, so `data:text/html` executes), as are scheme-less relative URLs (a relative frame source frames the embedding app itself) and the link-only schemes `mailto`/`tel`/`sms`/`xmpp`/`irc`.
  - `src/lib/sanitize-blocks.ts`: the exact-match key sets are gone. Keys are classified by **name shape** — anything whose last `_`-delimited segment is `url`/`uri`/`link`/`href`/`src` is sanitized, image-ish names (`image`, `thumb`, `icon`, `avatar`, `logo`, `photo`, `picture`) get the image allowlist, `video_url` gets the embed allowlist, everything else gets the link allowlist. Over-matching is free: a URL-shaped key holding a non-URL string has no recognized scheme, so it is treated as relative and passed through. This is the structural half of the fix — a hand-maintained key set had by then missed a field twice.
  - `src/components/preview/slack-block-preview.tsx`: a third scrub arm over `iframe[src], embed[src], object[data], source[src], video[src], audio[src], track[src]`, applying the embed allowlist and marking blocked elements `data-bk-blocked-src`.
  - `src/components/editors/video-editor.tsx`: all four URL fields flag an unsafe value with `aria-invalid` and an inline note, matching the structured rich-text editor.
- **Tests**: [test/preview-url-scrub.test.tsx](test/preview-url-scrub.test.tsx) is the one that would have caught this. It renders hostile payloads and then walks **every** element of the result, asserting that no URL-bearing attribute on any tag that navigates or auto-loads carries anything but an http(s) URL — rather than asserting on the fields we happen to know about today. A renderer upgrade that emits a new URL-bearing tag, or a Slack block that adds a new URL field, fails there. Field-level coverage in [test/sanitize-blocks.test.ts](test/sanitize-blocks.test.ts), [test/url-safety.test.ts](test/url-safety.test.ts), [test/public-api.test.ts](test/public-api.test.ts), and [test/video-editor.test.tsx](test/video-editor.test.tsx). All 14 new assertions fail against the pre-fix tree.
- **Follow-up (2026-09-03) — the renderer's `iframeProps` prop bag**: re-verifying the fix above turned up a fourth path into the same `<iframe>`. `slack-blocks-to-jsx` destructures `iframeProps` off the video block payload and spreads it onto the frame *after* its own `src`. It is a documented renderer extension, not a Slack field, so `sanitizeBlock` and `toSlackBlocks` both passed it through: the key-shape URL classifier sees a `src` inside it, but `srcdoc`, `sandbox`, and `allow` are not URLs. A payload of `{"type":"video","video_url":"https://…","iframeProps":{"srcdoc":"<script>…</script>"}}` rendered `<iframe srcdoc="<script>…">`, and an inline frame document runs with the embedding app's **own** origin on every React version — the same-origin outcome the `data:` variant above does not reach. Reproduced in jsdom against the fixed tree.
  - `src/lib/sanitize-blocks.ts`: any key whose last `_`-delimited segment is `props` (`iframeProps`, `iframe_props`, a future `imgProps`) is dropped wherever it appears, at both boundaries. Same name-shape reasoning as the URL keys: Slack has no such field and rejects one on send, so over-matching costs nothing.
  - `src/components/preview/slack-block-preview.tsx`: a backstop arm strips `srcdoc` from every frame, whatever its value, and marks it `data-bk-blocked-srcdoc`. The renderer never emits one itself.
  - `toSlackBlocks` output for such a payload now passes the validator, which had been rejecting the bag as `unknown property 'iframeProps'`.
  - Tests: prop-bag cases in [test/preview-url-scrub.test.tsx](test/preview-url-scrub.test.tsx) (payload layer, asserting the legitimate `video_url` survives and no `srcdoc`/`sandbox`/`allow` lands on the frame) and [test/preview-srcdoc-scrub.test.tsx](test/preview-srcdoc-scrub.test.tsx) (DOM layer, with the payload sanitizer mocked to a pass-through so the scrub has to do the work), plus [test/sanitize-blocks.test.ts](test/sanitize-blocks.test.ts) and [test/public-api.test.ts](test/public-api.test.ts).
- **Residual risk**: `slack-blocks-to-jsx` still has no scheme allowlist of its own; ours is applied on both sides of it. Pushing one upstream would close this class at the source for every consumer of that package.

---

## Items checked and clean

These were inspected, deemed safe as-shipped, and noted here so future reviewers can see what was covered:

- **`dangerouslySetInnerHTML`**: exactly one occurrence ([brand-theme-scope.tsx:73](src/components/brand-theme-scope.tsx:73)), defended by [`isSafeCssValue`](src/lib/brand-theme.ts:122) — 200-char cap, rejects `;{}<>&` and CSS comment markers and newlines. The scope id is `useId()`-derived. Verified: a malicious `tokens.primary = "red; <script>"` is rejected by the regex before injection, and any value that does pass cannot break out of the declaration into a new rule or close the `<style>` element. Note for future contributors: do **not** widen the regex without re-deriving the proof.
- **`eval` / `new Function` / `vm.runIn*`**: zero occurrences anywhere in `src/`.
- **`innerHTML` / `outerHTML` / `document.write` / `insertAdjacentHTML`**: zero occurrences.
- **`postMessage` handlers**: none.
- **`localStorage` / `sessionStorage` / `document.cookie`**: not read or written by the library itself (state persistence is delegated to the consumer per design).
- **Clipboard reads**: none.
- **Raw `fetch` / XHR**: not performed by the library; all I/O is brokered by consumer callbacks (`loadChannels`, `loadSendAsUserStatus`, `onSend`).
- **File uploads / `FileReader` / `URL.createObjectURL`**: none.
- **`<iframe>` elements**: none constructed by `src/` itself — but `slack-blocks-to-jsx` renders one for the video block's `video_url`, which is what F-009 missed, and spreads the payload's `iframeProps` onto it, which the F-009 follow-up missed. The preview's DOM scrub now covers `iframe`/`embed`/`object`/`source`/`video`/`audio`/`track` sources and strips `srcdoc`, and the sanitizer drops the prop bag before render, so "we don't write `<iframe>`" is not the same as "no `<iframe>` renders".
- **`JSON.parse` of untrusted input**: two sites ([url-state.ts:42](src/lib/url-state.ts:42), [json-drawer.tsx:64](src/components/json-drawer.tsx:64)) — both wrapped in try/catch, top-level array check, and now size-capped. `__proto__` keys in JSON do not pollute `Object.prototype` in modern engines and the sanitizer was verified to be free of `Object.assign`-flavored merges that walk the prototype chain ([test/sanitize-blocks.test.ts](test/sanitize-blocks.test.ts) `prototype pollution shape`).
- **Random IDs**: `nanoid@5.x` (CSPRNG-backed). Not used for security tokens; appropriate.
- **Toolbar docs link**: [toolbar.tsx:158-166](src/components/toolbar.tsx:158) is a hardcoded `docs.slack.dev` URL with `rel="noreferrer noopener"`. Safe.
- **`.gitignore`**: `.env*` excluded. No `.env*` tracked.
- **Action pinning**: `actions/checkout@v6`, `dependabot/fetch-metadata@v3`, `googleapis/release-please-action@v5`. Major-tag pins, GitHub's recommended practice for trusted publishers. SHA-pinning is the highest-rigor option (see Info-002). _Superseded 2026-09-03: every third-party action is now pinned to a full commit SHA with the release version in a trailing comment (Dependabot keeps both current), and the publish step pins the npm CLI to an exact version instead of `npm@latest`._
- **CI trigger**: uses `pull_request` (NOT the footgun `pull_request_target`).
- **`npm publish` provenance**: enabled via `--provenance` in the publish workflow.
- **`prepublishOnly`**: runs `build:clean && test` — local `pnpm publish` is gated.
- **`pnpm audit`**: 0 advisories at the time of review (679 dependencies, 0 critical / 0 high / 0 moderate / 0 low / 0 info).

## Informational notes

- **Info-001 — Validator scope.** `@tightknitai/slack-block-kit-validator@0.1.0-alpha.0` is a structural validator. Its `format: "uri"` rule accepts any RFC-3986 URI and is **not** a URI-scheme allowlist. Do not rely on it for sanitizing user URLs at any layer.
- **Info-002 — Action SHA pinning.** Consider SHA-pinning all third-party actions in `.github/workflows/` (`dependabot/fetch-metadata`, `googleapis/release-please-action`) for the highest supply-chain rigor. Major-tag pinning is the current GitHub recommendation and is acceptable. _Done 2026-09-03, after an external report (CWE-829) pointed out that `release-please-action@v5` and `npx npm@latest` were both mutable refs executing inside the one job that holds `id-token: write`. Every `uses:` outside `./.github/actions/setup` is now a commit SHA, and the npm CLI is an exact version._
- **Info-003 — CSP guidance for consumers.** This is a UI library; we cannot set HTTP response headers ourselves. Consumers should set a strict CSP (`script-src 'self'`, `style-src 'self' 'unsafe-inline'` to permit our scoped brand `<style>`, `img-src https: data:`, `connect-src 'self' slack.com`). Worth adding to `README.md` as a "Hardening guide".
- **Info-004 — Consumer-trust contract for `loadSendAsUserStatus`.** The library now refuses to render an unsafe `oauthUrl`. Consumers should know that we will silently drop a `javascript:`-flavoured value rather than render it. Document in the prop's JSDoc on the next minor.

## Residual risk passed through to consumers

- The library does not (and cannot) prevent a consumer from rendering the same block payload in their own UI without the preview boundary. Consumers should call the public `toSlackBlocks(...)` before passing a block list to any non-builder renderer; that is now the documented hardening boundary.
- The shareable URL state codec is intentionally a transparent base64url-of-JSON. Consumers must treat decoded blocks as untrusted; they will be sanitized when rendered by `SlackBlockPreview` or returned by `toSlackBlocks`, but anything else the consumer does with them is the consumer's responsibility. Document on the next minor.

## File map of the fixes

```
src/lib/url-safety.ts                                 (new)   F-001
src/lib/sanitize-blocks.ts                            (new)   F-001
src/components/preview/slack-block-preview.tsx        (edit)  F-001
src/lib/to-slack-blocks.ts                            (edit)  F-001
src/components/editors/rich-text-editor.tsx           (edit)  F-001, F-003
src/lib/rich-text-tiptap.ts                           (edit)  F-001
src/components/editors/rich-text-structured-editor.tsx (edit) F-001
src/components/send-dialog.tsx                        (edit)  F-002, F-008
src/lib/url-state.ts                                  (edit)  F-004
src/components/json-drawer.tsx                        (edit)  F-005
.github/workflows/dependabot-automerge.yml            (edit)  F-006
.github/workflows/publish.yml                         (edit)  F-007
test/url-safety.test.ts                               (new)   F-001
test/sanitize-blocks.test.ts                          (new)   F-001
test/public-api.test.ts                               (edit)  F-001, F-004
```

Follow-up:

```
src/lib/url-safety.ts                                 (edit)  F-009
src/lib/sanitize-blocks.ts                            (edit)  F-009
src/components/preview/slack-block-preview.tsx        (edit)  F-009
src/components/editors/video-editor.tsx               (edit)  F-009
test/preview-url-scrub.test.tsx                       (new)   F-009
test/video-editor.test.tsx                            (new)   F-009
test/url-safety.test.ts                               (edit)  F-009
test/sanitize-blocks.test.ts                          (edit)  F-009
test/public-api.test.ts                               (edit)  F-009
```

Follow-up (`iframeProps`):

```
src/lib/sanitize-blocks.ts                            (edit)  F-009
src/lib/to-slack-blocks.ts                            (edit)  F-009
src/components/preview/slack-block-preview.tsx        (edit)  F-009
test/preview-srcdoc-scrub.test.tsx                    (new)   F-009
test/preview-url-scrub.test.tsx                       (edit)  F-009
test/sanitize-blocks.test.ts                          (edit)  F-009
test/public-api.test.ts                               (edit)  F-009
```
