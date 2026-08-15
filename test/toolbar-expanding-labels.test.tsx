/**
 * Behavior guard for the toolbar's expand-on-hover utilities (Clear, View
 * JSON), measured in a real browser against the *built* stylesheet.
 *
 * The reveal is pure CSS — a `0fr` → `1fr` grid track under `group-hover` /
 * `group-focus-visible` — so nothing re-renders for an assertion on the
 * component tree to catch. The Storybook runner can't see it either: its
 * `userEvent` dispatches synthetic pointer events, which never set `:hover`.
 * Only the real mouse move and Tab press below do.
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
    // A block in the draft so Clear is enabled — the keyboard case tabs
    // through it, and a disabled button takes no focus.
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
    // 20px catches a dead animation without pinning font metrics.
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

    // A real Tab press: `:focus-visible` keys off the input modality, so a
    // programmatic `.focus()` alone would not prove it.
    await tab.focus(CLEAR_BUTTON);
    await tab.keyboard.press('Tab');
    await tab.waitForTimeout(SETTLE_MS);

    expect(await tab.evaluate(() => document.activeElement?.getAttribute('aria-label'))).toBe('View JSON');
    expect(await widthOf(tab, JSON_BUTTON)).toBeGreaterThan(collapsed + 20);
    await tab.close();
  });

  it('keeps the label out of the accessible name either way', async () => {
    const tab = await open();
    // The text stays in the DOM through the collapse, but the `aria-label`
    // was always the accessible name — same reading open or shut.
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
