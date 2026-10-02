/**
 * Links inside the rich text editor must look like links — Slack's link blue,
 * underlined — the way the preview renders them, measured against the *built*
 * stylesheet in a real browser. The editor lives in a portalled popover, so a
 * host reset such as Tailwind preflight's `a { color: inherit; text-decoration:
 * inherit }` reaches it; jsdom has no cascade to catch that with.
 */
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildStylesheet, launchChromium } from './built-stylesheet';

/** Tailwind preflight's anchor reset, loaded after the package stylesheet. */
const HOST_RESET = 'a { color: inherit; text-decoration: inherit; }';

describe('rich text editor links (built stylesheet, real browser)', () => {
  let browser: Browser;
  let css: string;

  beforeAll(async () => {
    css = buildStylesheet();
    browser = await launchChromium();
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Computed color and decoration of a link in the editor, under `htmlClass`. */
  async function linkStyle(htmlClass = ''): Promise<{ color: string; decoration: string }> {
    const tab = await browser.newPage();
    await tab.setContent(`<!doctype html><html class="${htmlClass}"><head><meta charset="utf-8">
      <style>${css}</style><style>${HOST_RESET}</style></head>
      <body><div class="bk-portal-content"><div class="bk-rich-editor">
        <p>Read <a href="https://example.com">the docs</a></p>
      </div></div></body></html>`);
    const style = await tab.evaluate(() => {
      const s = getComputedStyle(document.querySelector('a') as HTMLAnchorElement);
      return { color: s.color, decoration: s.textDecorationLine };
    });
    await tab.close();
    return style;
  }

  it('renders links in Slack blue with an underline', async () => {
    expect(await linkStyle()).toEqual({ color: 'rgb(18, 100, 163)', decoration: 'underline' });
  });

  it('switches to the dark-theme link blue under a .dark host', async () => {
    expect(await linkStyle('dark')).toEqual({ color: 'rgb(29, 155, 209)', decoration: 'underline' });
  });
});
