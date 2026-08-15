/**
 * Layout regression guard for the builder shell, measured in a real browser
 * against the *built* stylesheet — the only place this is observable, since
 * jsdom implements neither layout nor `svh`.
 *
 * `h-full` computes to `auto` against a host that supplies no height, which
 * left every internal `overflow-y-auto` inert and grew the shell to its
 * tallest child: the palette, a couple of thousand pixels of variant list.
 * `max-h-[var(--bk-max-height,100svh)]` bounds that. Pinned here: it bounds
 * an unbounded host, stays inert under a smaller host height, and honors
 * `--bk-max-height`.
 */
import { render } from '@testing-library/react';
import type { Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BlockKitchen } from '../src/components/block-kitchen';
import { buildStylesheet, launchChromium } from './built-stylesheet';

const VIEWPORT = { width: 1280, height: 800 };

/** `100svh` of an 800px viewport, in px. */
const CAPPED_HEIGHT = 800;

/** A definite host height comfortably under the cap, so the cap can't bind. */
const BOUNDED_HEIGHT = 520;

/** What one host shape's measurement pass reports back. */
interface Measurements {
  page: { scrollHeight: number };
  root: { maxHeight: string; height: number };
  /** The palette rail. */
  aside: { clientHeight: number; scrollHeight: number; overflowY: string };
  /** The palette's sticky search header. */
  stickyHeader: { position: string; backgroundColor: string; backgroundAlpha: number };
  /** The preview pane. */
  main: { clientHeight: number; overflowY: string };
}

describe('builder shell scrolling (built stylesheet, real browser)', () => {
  let browser: Browser;
  let css: string;
  let markup: string;

  beforeAll(async () => {
    css = buildStylesheet();
    // The real builder, rendered by React, so the assertions run against the
    // class strings the component actually emits.
    const { container } = render(<BlockKitchen workspaceName="Acme Inc." />);
    markup = container.innerHTML;
    browser = await launchChromium();
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * Load the builder inside `host`, and read back the geometry the scrolling
   * depends on.
   * @param host - inline style for the element wrapping the builder, i.e. the
   *   height contract a consuming app hands it
   * @returns the measurements for that host shape
   */
  async function measure(host: string): Promise<Measurements> {
    const tab = await browser.newPage({ viewport: VIEWPORT });
    await tab.setContent(
      `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style>
        <style>body { margin: 0 }</style></head>
        <body><div id="host" style="${host}">${markup}</div></body></html>`
    );
    const result = await tab.evaluate(() => {
      const pick = (selector: string): HTMLElement => {
        const el = document.querySelector(selector);
        if (!el) {
          throw new Error(`no element matched ${selector}`);
        }
        return el as HTMLElement;
      };
      const root = pick('.bk-root');
      const aside = pick('.bk-root aside');
      const main = pick('.bk-root main');
      // Class-token selector, so a renamed utility fails loudly here rather
      // than silently measuring the wrong box.
      const stickyHeader = pick('.bk-root aside [class~="sticky"]');
      return {
        page: { scrollHeight: document.documentElement.scrollHeight },
        root: { maxHeight: getComputedStyle(root).maxHeight, height: root.getBoundingClientRect().height },
        aside: {
          clientHeight: aside.clientHeight,
          scrollHeight: aside.scrollHeight,
          overflowY: getComputedStyle(aside).overflowY
        },
        stickyHeader: {
          position: getComputedStyle(stickyHeader).position,
          backgroundColor: getComputedStyle(stickyHeader).backgroundColor,
          // Alpha off a painted pixel, not the string: Chromium serializes
          // this as `oklab(… / 0.2)`, which isn't worth pinning.
          backgroundAlpha: (() => {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
            ctx.fillStyle = getComputedStyle(stickyHeader).backgroundColor;
            ctx.fillRect(0, 0, 1, 1);
            return ctx.getImageData(0, 0, 1, 1).data[3];
          })()
        },
        main: { clientHeight: main.clientHeight, overflowY: getComputedStyle(main).overflowY }
      };
    });
    await tab.close();
    return result;
  }

  it('bounds itself and scrolls the palette when the host supplies no height', async () => {
    // The reported bug's exact shape: a plain block-level wrapper in document
    // flow, which is what `h-full` has nothing to resolve against.
    const m = await measure('');

    expect(m.root.maxHeight).toBe(`${CAPPED_HEIGHT}px`);
    expect(m.root.height).toBeLessThanOrEqual(CAPPED_HEIGHT);

    // The rail is bounded and scrolls on its own — the whole point.
    expect(m.aside.overflowY).toBe('auto');
    expect(m.aside.clientHeight).toBeGreaterThan(0);
    expect(m.aside.clientHeight).toBeLessThan(CAPPED_HEIGHT);
    expect(m.aside.scrollHeight).toBeGreaterThan(m.aside.clientHeight);

    // ...and the page no longer grows to the palette's full content height.
    expect(m.page.scrollHeight).toBeLessThanOrEqual(CAPPED_HEIGHT);
    expect(m.page.scrollHeight).toBeLessThan(m.aside.scrollHeight);

    // The preview scrolls independently rather than sharing one scrollbar.
    expect(m.main.overflowY).toBe('auto');
    expect(m.main.clientHeight).toBeGreaterThan(0);
    expect(m.main.clientHeight).toBeLessThan(CAPPED_HEIGHT);
  });

  it('leaves the cap inert when the host does supply a height', async () => {
    const m = await measure(`height: ${BOUNDED_HEIGHT}px`);

    // A host that sizes the builder still wins: the cap is a floor under
    // the unbounded case, not a ceiling on the bounded one.
    expect(m.root.height).toBe(BOUNDED_HEIGHT);
    expect(m.aside.clientHeight).toBeLessThan(BOUNDED_HEIGHT);
    expect(m.aside.scrollHeight).toBeGreaterThan(m.aside.clientHeight);
    expect(m.page.scrollHeight).toBeLessThanOrEqual(CAPPED_HEIGHT);
  });

  it('honors --bk-max-height as the escape hatch', async () => {
    const capped = await measure('--bk-max-height: 400px');
    expect(capped.root.height).toBe(400);
    expect(capped.aside.scrollHeight).toBeGreaterThan(capped.aside.clientHeight);

    // `none` restores the old grow-to-content behavior for hosts that want it.
    const uncapped = await measure('--bk-max-height: none');
    expect(uncapped.root.maxHeight).toBe('none');
    expect(uncapped.root.height).toBeGreaterThan(CAPPED_HEIGHT);
    expect(uncapped.aside.scrollHeight).toBe(uncapped.aside.clientHeight);
  });

  it('paints the palette’s sticky header opaque so scrolled rows cannot read through it', async () => {
    const m = await measure('');

    expect(m.stickyHeader.position).toBe('sticky');
    // A translucent header composites over the scrolled list, and headings
    // show through the search box. Only an opaque base hides them.
    expect(m.stickyHeader.backgroundAlpha).toBe(255);
  });
});
