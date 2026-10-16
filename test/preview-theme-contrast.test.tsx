/**
 * Preview text must clear WCAG AA (4.5:1) in both preview themes, and the
 * preview overrides must stay inside our own preview root. Measured against
 * the *built* stylesheet in a real browser: the contrast depends on the
 * cascade between upstream's theme variants and our overrides, which jsdom
 * cannot compute.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildStylesheet, launchChromium } from './built-stylesheet';

/** The builder canvas behind the preview in each theme. */
const CANVAS = { light: '#ffffff', dark: '#1a1d21' } as const;

/** WCAG AA minimum for normal-size text. */
const AA = 4.5;

/** Markup upstream emits for each case, keyed by the case name. */
const CASES = `
  <p><span data-case="user" class="slack_user slack_blocks_to_jsx__rich_text_section_element_user">@Ada Example</span></p>
  <p><span data-case="channel" class="slack_channel slack_blocks_to_jsx__rich_text_section_element_channel">#general</span></p>
  <p><span data-case="user group" class="slack_user_group slack_blocks_to_jsx__rich_text_section_element_user_group">@design-team</span></p>
  <p><code data-case="mrkdwn inline code" class="slack_code_inline inline-block px-1 text-xs rounded-[3px] border border-black-primary/[0.13] dark:border-dark-code-border bg-black-primary/[0.04] dark:bg-dark-code-bg text-red-primary dark:text-dark-text-primary font-mono">pnpm lint</code></p>
  <p><span data-case="rich text inline code" class="slack_blocks_to_jsx__rich_text_section_element_text slack_inline_code">pnpm test</span></p>
  <p><a data-case="link" href="https://example.com" class="slack_blocks_to_jsx__rich_text_section_element_link text-blue-primary dark:text-dark-link">example.com</a></p>
`;

describe('preview theme contrast (built stylesheet, real browser)', () => {
  let browser: Browser;
  let css: string;

  beforeAll(async () => {
    css = buildStylesheet();
    browser = await launchChromium();
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Contrast ratio of each case's text against its own background composited on the canvas. */
  async function previewContrast(theme: keyof typeof CANVAS): Promise<Record<string, number>> {
    const tab = await browser.newPage();
    await tab.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head>
      <body><div class="bk-root" style="background:${CANVAS[theme]}">
        <div id="slack_blocks_to_jsx" data-theme="${theme}" class="slack_blocks_to_jsx styles_enabled">${CASES}</div>
      </div></body></html>`);
    const ratios = await tab.evaluate((canvasColor) => {
      const ctx = document
        .createElement('canvas')
        .getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
      const rgba = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return { r, g, b, a: a / 255 };
      };
      type Rgba = ReturnType<typeof rgba>;
      const over = (top: Rgba, under: Rgba): Rgba => ({
        r: top.r * top.a + under.r * (1 - top.a),
        g: top.g * top.a + under.g * (1 - top.a),
        b: top.b * top.a + under.b * (1 - top.a),
        a: 1
      });
      const luminance = ({ r, g, b }: Rgba) => {
        const channel = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const canvas = rgba(canvasColor);
      const result: Record<string, number> = {};
      for (const el of document.querySelectorAll<HTMLElement>('[data-case]')) {
        const style = getComputedStyle(el);
        const background = over(rgba(style.backgroundColor), canvas);
        const text = over(rgba(style.color), background);
        const [hi, lo] = [luminance(text), luminance(background)].sort((x, y) => y - x);
        result[el.dataset.case as string] = (hi + 0.05) / (lo + 0.05);
      }
      return result;
    }, CANVAS[theme]);
    await tab.close();
    return ratios;
  }

  it.each(['light', 'dark'] as const)('keeps every case at AA contrast in the %s preview', async (theme) => {
    const ratios = await previewContrast(theme);
    expect(Object.keys(ratios)).toHaveLength(6);
    for (const [name, ratio] of Object.entries(ratios)) {
      expect(ratio, `${name} in the ${theme} preview`).toBeGreaterThanOrEqual(AA);
    }
  });

  /** Computed color and decoration of each case in an unstyled host root, under `stylesheet`. */
  async function hostStyles(stylesheet: string, theme: keyof typeof CANVAS) {
    const tab = await browser.newPage();
    await tab.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${stylesheet}</style></head>
      <body><div id="slack_blocks_to_jsx" data-theme="${theme}" class="slack_blocks_to_jsx styles_disabled">${CASES}</div></body></html>`);
    const styles = await tab.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>('[data-case]')].map((el) => {
          const style = getComputedStyle(el);
          return [el.dataset.case, `${style.color} ${style.textDecorationLine}`];
        })
      )
    );
    await tab.close();
    return styles;
  }

  it.each(['light', 'dark'] as const)(
    'leaves an unstyled %s host root that shares the preview id as upstream renders it',
    async (theme) => {
      const upstreamOnly = readFileSync(join(process.cwd(), 'node_modules/slack-blocks-to-jsx/dist/style.css'), 'utf8');
      expect(await hostStyles(css, theme)).toEqual(await hostStyles(upstreamOnly, theme));
    }
  );
});
