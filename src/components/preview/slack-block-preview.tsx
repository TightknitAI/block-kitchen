import 'slack-blocks-to-jsx/dist/style.css';

import { useEffect, useMemo, useRef } from 'react';
import type { Block } from 'slack-blocks-to-jsx';
import { Message } from 'slack-blocks-to-jsx';
import { sanitizeBlock } from '../../lib/sanitize-blocks';
import { isSafeEmbedSrc, isSafeHref, isSafeImageSrc } from '../../lib/url-safety';
import type { PreviewHooks, PreviewTheme, SupportedBlock } from '../../types';

/**
 * Elements whose source attribute makes the browser load a document or
 * subresource on its own, with no click. `slack-blocks-to-jsx` renders a
 * video block's `video_url` into `<iframe src>`; the rest are covered so
 * a renderer upgrade that starts emitting one of them is scrubbed from
 * day one rather than after the next report.
 */
const EMBED_SELECTOR = 'iframe[src], embed[src], object[data], source[src], video[src], audio[src], track[src]';

/**
 * Renders a Slack block via the `slack-blocks-to-jsx` library's `<Message>`
 * component. We render exactly one block at a time so each row in the
 * surface owns its drag and edit affordances; the wrapper-less mode keeps
 * the library from injecting its own message chrome (avatar/timestamp).
 *
 * The library handles: section, header, divider, context, actions, image,
 * rich_text, file, video, and most mrkdwn / rich-text formatting.
 *
 * `previewHooks` is forwarded as-is so the consumer can resolve user /
 * channel / emoji / link directives to its own UI when desired.
 * @param props - preview props
 * @param props.block - the single block to render
 * @param props.hooks - optional directive replacement hooks
 * @param props.theme - light or dark preview theme (default 'light')
 * @returns the rendered Slack block preview
 */
export function SlackBlockPreview({
  block,
  hooks,
  theme = 'light'
}: {
  block: SupportedBlock;
  hooks?: PreviewHooks;
  theme?: PreviewTheme;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  // Strip dangerous URI schemes (`javascript:`, `data:text/html`, etc.)
  // from every `url`/`image_url` field in the block before handing it
  // to slack-blocks-to-jsx, which renders rich-text links, button URLs,
  // and image sources directly into `<a href>` / `<img src>` without
  // its own scheme filter. Memoized so an unchanged block keeps the
  // same reference and doesn't churn the renderer.
  const safeBlock = useMemo(() => sanitizeBlock(block), [block]);

  // slack-blocks-to-jsx renders an SVG-only collapse toggle in image and
  // video blocks without an aria-label, which violates axe's `button-name`
  // rule and is unreachable to screen readers. Post-mount we add a label
  // to any such buttons we find under our wrapper. We also do a final
  // pass to neutralize any `<a href>`, `<img src>`, or frame/subresource
  // source that carries a disallowed URI scheme — the block-payload
  // sanitizer catches URLs that live in structured fields (`url`,
  // `image_url`, `video_url`), but mrkdwn / rich-text content can encode
  // link URLs inside text strings (`[label](javascript:...)` or
  // `<javascript:...|label>`) that `slack-blocks-to-jsx`'s own parser
  // hands straight to `<a href>` without filtering. React 19 also blocks
  // `javascript:` URLs at setAttribute time, but we don't rely on that —
  // this loop applies our allowlist (which is tighter and covers
  // `data:`/`vbscript:`/`file:` as well) and replaces unsafe values with
  // `#`. Frames get the strictest arm: an `<iframe src>` loads on render
  // rather than on click, so `data:text/html` there executes script in an
  // opaque origin on every React version and only http(s) is allowed.
  // A frame also loses any `srcdoc`: the renderer never emits one itself
  // — it could only arrive via the payload's `iframeProps` bag, which the
  // sanitizer drops — and an inline document runs in the embedding app's
  // own origin, with no scheme to allowlist.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    for (const wrapper of root.querySelectorAll<HTMLElement>(
      '.slack_blocks_to_jsx__image_media_trigger, .slack_blocks_to_jsx__video_title'
    )) {
      for (const btn of wrapper.querySelectorAll<HTMLButtonElement>('button:not([aria-label])')) {
        const title = wrapper.querySelector('.slack_blocks_to_jsx__image_title')?.textContent?.trim();
        btn.setAttribute('aria-label', title ? `Toggle ${title}` : 'Toggle media');
      }
    }
    for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = a.getAttribute('href');
      if (!isSafeHref(href)) {
        a.setAttribute('href', '#');
        a.setAttribute('data-bk-blocked-href', '1');
      }
    }
    for (const img of root.querySelectorAll<HTMLImageElement>('img[src]')) {
      const src = img.getAttribute('src');
      if (!isSafeImageSrc(src)) {
        img.removeAttribute('src');
        img.setAttribute('data-bk-blocked-src', '1');
      }
    }
    for (const el of root.querySelectorAll<HTMLElement>(EMBED_SELECTOR)) {
      const attr = el.tagName === 'OBJECT' ? 'data' : 'src';
      if (!isSafeEmbedSrc(el.getAttribute(attr))) {
        el.removeAttribute(attr);
        el.setAttribute('data-bk-blocked-src', '1');
      }
    }
    for (const frame of root.querySelectorAll<HTMLIFrameElement>('iframe[srcdoc]')) {
      frame.removeAttribute('srcdoc');
      frame.setAttribute('data-bk-blocked-srcdoc', '1');
    }
  });

  return (
    // The library scopes all of its CSS under `#slack_blocks_to_jsx` and
    // depends on the `slack_blocks_to_jsx styles_enabled` classes plus the
    // `data-theme` attribute for its button / mention / divider styling
    // (e.g. button reset + `bg-green-primary` for primary). `<Message
    // withoutWrapper>` skips that wrapper entirely, so we re-create it
    // here without the avatar / timestamp chrome.
    <div ref={rootRef} id="slack_blocks_to_jsx" data-theme={theme} className="slack_blocks_to_jsx styles_enabled">
      <Message
        time={new Date()}
        name=""
        logo=""
        withoutWrapper
        theme={theme}
        blocks={[safeBlock as unknown as Block]}
        hooks={hooks as Record<string, unknown> | undefined}
      />
    </div>
  );
}
