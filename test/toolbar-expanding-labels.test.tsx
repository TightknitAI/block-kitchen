/**
 * Behavior guard for the toolbar's expand-on-hover utilities (Clear, View
 * JSON), measured in a real browser against the *built* stylesheet.
 *
 * They rest as bare icons and slide their label open on hover or keyboard
 * focus. All of that is CSS — a `0fr` → `1fr` grid track under `group-hover`
 * / `group-focus-visible` — so nothing in React re-renders and no assertion
 * on the component tree can see it. The Storybook runner can't either: its
 * `userEvent` dispatches synthetic pointer events, which never set `:hover`.
 * Only a real mouse move and a real Tab press do, which is what this drives.
 */
import { render } from '@testing-library/react';
import type { Browser, Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import type { SupportedBlock } from '../src/types';
import { buildStylesheet, launchChromium } from './built-stylesheet';

const VIEWPORT = { width: 1280, height: 800 };

/** Icon plus the button's own padding — no label. */
const COLLAPSED_MAX = 48;

/** Comfortably longer than the 200ms track transition. */
const SETTLE_MS = 400;

const JSON_BUTTON = '[aria-label="View JSON"]';
const CLEAR_BUTTON = '[aria-label="Clear all blocks"]';

describe('toolbar expanding labels (built stylesheet, real browser)', () => {
  let browser: Browser;
  let page: string;

  beforeAll(async () => {
    const css = buildStylesheet();
    // A block in the draft so Clear is enabled: a disabled button takes no
    // focus, and the keyboard case below tabs through it.
    const { container } = render(
      <BlockKitchen workspaceName="Acme Inc." initialBlocks={[{ type: 'divider' }] as SupportedBlock[]} />
    );
    page = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
      <style>body { margin: 0 }</style></head><body>${container.innerHTML}</body></html>`;
    browser = await launchChromium();
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  /** Width of the button matching `selector`, in px. */
  const widthOf = (tab: Page, selector: string): Promise<number> =>
    tab.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) {
        throw new Error(`no element matched ${sel}`);
      }
      return el.getBoundingClientRect().width;
    }, selector);

  /** A fresh tab with the toolbar loaded, mouse parked away from it. */
  async function open(): Promise<Page> {
    const tab = await browser.newPage({ viewport: VIEWPORT });
    await tab.setContent(page);
    await tab.mouse.move(0, VIEWPORT.height - 1);
    return tab;
  }

  it('rests as icons and opens the hovered label only', async () => {
    const tab = await open();
    const collapsed = await widthOf(tab, JSON_BUTTON);
    expect(collapsed).toBeLessThan(COLLAPSED_MAX);
    expect(await widthOf(tab, CLEAR_BUTTON)).toBeLessThan(COLLAPSED_MAX);

    await tab.hover(JSON_BUTTON);
    await tab.waitForTimeout(SETTLE_MS);
    const expanded = await widthOf(tab, JSON_BUTTON);
    // "View JSON" is a good deal wider than its icon; 20px is a floor that
    // catches a dead animation without pinning the exact font metrics.
    expect(expanded).toBeGreaterThan(collapsed + 20);
    // Its neighbour is untouched — the group scopes to one button.
    expect(await widthOf(tab, CLEAR_BUTTON)).toBeLessThan(COLLAPSED_MAX);

    // And it closes again on the way out.
    await tab.mouse.move(0, VIEWPORT.height - 1);
    await tab.waitForTimeout(SETTLE_MS);
    expect(await widthOf(tab, JSON_BUTTON)).toBe(collapsed);
    await tab.close();
  });

  it('opens the label on keyboard focus, so the icons are not mouse-only', async () => {
    const tab = await open();
    const collapsed = await widthOf(tab, JSON_BUTTON);

    // Reach the button by a real Tab press: `:focus-visible` keys off the
    // input modality, so a programmatic `.focus()` alone would not prove it.
    await tab.focus(CLEAR_BUTTON);
    await tab.keyboard.press('Tab');
    await tab.waitForTimeout(SETTLE_MS);

    expect(await tab.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('View JSON');
    expect(await widthOf(tab, JSON_BUTTON)).toBeGreaterThan(collapsed + 20);
    await tab.close();
  });

  it('keeps the label out of the accessible name either way', async () => {
    const tab = await open();
    // The label text stays in the DOM through the collapse; every one of
    // these buttons carries an `aria-label`, so it was never the accessible
    // name and assistive tech reads the same thing open or shut.
    const names = await tab.evaluate(
      ([json, clear]) => ({
        json: document.querySelector(json)?.getAttribute('aria-label'),
        clear: document.querySelector(clear)?.getAttribute('aria-label'),
        jsonText: document.querySelector(json)?.textContent?.trim(),
        clearText: document.querySelector(clear)?.textContent?.trim()
      }),
      [JSON_BUTTON, CLEAR_BUTTON]
    );
    expect(names).toEqual({
      json: 'View JSON',
      clear: 'Clear all blocks',
      jsonText: 'View JSON',
      clearText: 'Clear'
    });
    await tab.close();
  });
});
