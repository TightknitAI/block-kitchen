/**
 * Cascade regression guard for the "Find an existing message" dialog, measured
 * in a real browser against the *built* stylesheet.
 *
 * Two failure modes are pinned down here, neither of which any other test can
 * see: jsdom implements neither `@scope` nor layout, and Storybook renders the
 * builder against plain, unscoped Tailwind.
 *
 * 1. `@scope` roots. Utilities ship inside
 *    `@scope (.bk-root, .bk-portal-content)`, and a scoped style rule never
 *    matches its own scoping root — only descendants. The dialog's own
 *    `max-h-[85svh] flex flex-col …` sits on `.bk-portal-content`, so until
 *    scripts/scope-utilities.mjs anchored those selectors every one of them was
 *    inert in a consuming app: nothing bounded the modal and it grew past the
 *    viewport, taking both panes' scrolling with it.
 * 2. Base-vs-variant overrides. `bk-utilities` is a named cascade layer that a
 *    host's own Tailwind build usually outranks, so a `lg:` utility can lose to
 *    a base utility for the same property that the host also emits. The dialog
 *    pairs mutually exclusive `max-lg:` / `lg:` variants instead of relying on
 *    such an override; this checks both halves land.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { type Browser, chromium } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LoadMessageDialog } from '../src/components/load-message-dialog';
import { TooltipProvider } from '../src/lib/ui/tooltip';
import type { LoadResult, RecentMessage, SupportedBlock } from '../src/types';

// Vitest runs from the package root, and `import.meta.url` is a dev-server URL
// under the jsdom environment rather than a file one.
const REPO_ROOT = process.cwd();

/** Two-column layout: at or above Tailwind's `lg` breakpoint (64rem). */
const WIDE = { width: 1280, height: 800 };
/** Stacked layout: below `lg`. Same height, so `svh` maths stay comparable. */
const NARROW = { width: 900, height: 800 };

/** `max-h-[85svh]` of an 800px viewport, in px. */
const CAPPED_HEIGHT = 680;

/** Long enough that the preview pane has to scroll rather than grow. */
const LONG_MESSAGE = Array.from({ length: 40 }, (_, i) => ({
  type: 'section',
  text: { type: 'mrkdwn', text: `Release note line ${i} — shipped a thing.` }
})) as SupportedBlock[];

/** More rows than the recent list can show, so it has to scroll too. */
const RECENT: RecentMessage[] = Array.from({ length: 40 }, (_, i) => ({
  channelId: 'C1',
  channelName: 'general',
  ts: `170000000${String(i).padStart(2, '0')}.000100`,
  blocks: LONG_MESSAGE,
  label: `Release notes ${i}`
}));

const noopLoad = async (): Promise<LoadResult> => ({ ok: false, reason: 'nope' });

/**
 * Compile the package stylesheet exactly as `pnpm build:css` does, into a temp
 * file so a stale (or missing) `dist/` can neither mask a regression nor be
 * clobbered by the test run.
 * @returns the built, scoped stylesheet
 */
function buildStylesheet(): string {
  const out = join(mkdtempSync(join(tmpdir(), 'bk-styles-')), 'styles.css');
  execFileSync(
    join(REPO_ROOT, 'node_modules/.bin/tailwindcss'),
    ['-i', './src/styles.src.css', '-o', out, '--minify'],
    {
      cwd: REPO_ROOT,
      stdio: 'pipe'
    }
  );
  execFileSync(process.execPath, ['./scripts/scope-utilities.mjs', out], { cwd: REPO_ROOT, stdio: 'pipe' });
  return readFileSync(out, 'utf8');
}

/**
 * Render the real dialog in jsdom, drive it to the state under test (a channel
 * picked, a long message selected), and hand back the markup React actually
 * produced — merged class strings and all.
 * @returns the portal markup for the open dialog
 */
async function renderDialogMarkup(): Promise<string> {
  render(
    <TooltipProvider>
      <LoadMessageDialog
        open
        onOpenChange={() => {}}
        onLoadMessage={noopLoad}
        loadChannels={async () => [{ id: 'C1', name: 'general' }]}
        loadRecentMessages={async () => RECENT}
        onLoaded={() => {}}
        onOpenAsNew={() => {}}
      />
    </TooltipProvider>
  );

  fireEvent.change(await screen.findByLabelText('Channel'), { target: { value: 'C1' } });
  const row = (await screen.findByText('Release notes 0')).closest('button') as HTMLButtonElement;
  fireEvent.click(row);
  expect(row.getAttribute('aria-pressed')).toBe('true');

  return document.body.innerHTML;
}

/** What one viewport's measurement pass reports back. */
interface Measurements {
  dialog: { maxHeight: string; maxWidth: string; display: string; flexDirection: string; height: number };
  body: { flexDirection: string; overflowY: string };
  list: { clientHeight: number; scrollHeight: number };
  preview: { clientHeight: number; scrollHeight: number };
  /** The other scoping root, which carries utilities of its own too. */
  builderRoot: { display: string; flexDirection: string; overflow: string };
  /** Same utilities, outside every package root — must stay unstyled. */
  outside: { maxHeight: string; display: string };
}

describe('load dialog cascade (built stylesheet, real browser)', () => {
  let browser: Browser;
  let page: string;

  beforeAll(async () => {
    const css = buildStylesheet();
    const markup = await renderDialogMarkup();
    // Two bare probes either side of the scope boundary: `.bk-root` is the
    // other scoping root and carries the builder shell's own layout, and an
    // element with the same utilities outside both roots must stay untouched.
    page = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${markup}
      <div id="builder-root" class="bk-root flex flex-col overflow-hidden">builder shell</div>
      <div id="outside" class="flex max-h-[85svh] flex-col">not inside any package root</div>
    </body></html>`;
    // `BK_CHROMIUM_EXECUTABLE` lets a pre-provisioned image point at its own
    // Chromium; CI uses `playwright install chromium` and needs no override.
    const executablePath = process.env.BK_CHROMIUM_EXECUTABLE;
    browser = await chromium.launch(executablePath ? { executablePath } : {});
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  /**
   * Load the dialog markup at `viewport` and read back the computed styles and
   * box metrics the layout depends on.
   * @param viewport - the viewport to measure at
   * @returns the measurements for that viewport
   */
  async function measure(viewport: { width: number; height: number }): Promise<Measurements> {
    const tab = await browser.newPage({ viewport });
    await tab.setContent(page);
    const result = await tab.evaluate(() => {
      const pick = (selector: string): Element => {
        const el = document.querySelector(selector);
        if (!el) {
          throw new Error(`no element matched ${selector}`);
        }
        return el;
      };
      // Class-token selectors, so a renamed utility fails loudly here rather
      // than silently measuring the wrong box.
      const dialog = pick('[role="dialog"]') as HTMLElement;
      const body = pick('[class~="max-lg:flex-col"]');
      const list = pick('[class~="max-lg:max-h-60"]');
      const preview = pick('[aria-label="Message preview"]');
      const builderRoot = pick('#builder-root');
      const outside = pick('#outside');
      return {
        dialog: {
          maxHeight: getComputedStyle(dialog).maxHeight,
          maxWidth: getComputedStyle(dialog).maxWidth,
          display: getComputedStyle(dialog).display,
          flexDirection: getComputedStyle(dialog).flexDirection,
          height: dialog.getBoundingClientRect().height
        },
        body: {
          flexDirection: getComputedStyle(body).flexDirection,
          overflowY: getComputedStyle(body).overflowY
        },
        list: { clientHeight: list.clientHeight, scrollHeight: list.scrollHeight },
        preview: { clientHeight: preview.clientHeight, scrollHeight: preview.scrollHeight },
        builderRoot: {
          display: getComputedStyle(builderRoot).display,
          flexDirection: getComputedStyle(builderRoot).flexDirection,
          overflow: getComputedStyle(builderRoot).overflow
        },
        outside: { maxHeight: getComputedStyle(outside).maxHeight, display: getComputedStyle(outside).display }
      };
    });
    await tab.close();
    return result;
  }

  it('bounds the dialog to the viewport at two-column widths, with both panes scrolling', async () => {
    const m = await measure(WIDE);

    // The scope-root regression, stated plainly: utilities on the element that
    // *is* the `@scope` root have to resolve.
    expect(m.dialog.maxHeight).toBe(`${CAPPED_HEIGHT}px`);
    expect(m.dialog.display).toBe('flex');
    expect(m.dialog.flexDirection).toBe('column');
    expect(m.dialog.maxWidth).toBe('896px'); // max-w-4xl
    expect(m.dialog.height).toBeLessThanOrEqual(CAPPED_HEIGHT);

    // Two columns, and the dialog body clips instead of scrolling as a whole.
    expect(m.body.flexDirection).toBe('row');
    expect(m.body.overflowY).toBe('hidden');

    // Both panes are bounded and scroll on their own.
    expect(m.preview.clientHeight).toBeGreaterThan(0);
    expect(m.preview.clientHeight).toBeLessThan(CAPPED_HEIGHT);
    expect(m.preview.scrollHeight).toBeGreaterThan(m.preview.clientHeight);
    expect(m.list.clientHeight).toBeGreaterThan(0);
    expect(m.list.clientHeight).toBeLessThan(CAPPED_HEIGHT);
    expect(m.list.scrollHeight).toBeGreaterThan(m.list.clientHeight);
  });

  it('stacks the panes below lg, each capped and scrolling', async () => {
    const m = await measure(NARROW);

    expect(m.dialog.maxHeight).toBe(`${CAPPED_HEIGHT}px`);
    expect(m.dialog.maxWidth).toBe('512px'); // max-lg:max-w-lg
    expect(m.dialog.height).toBeLessThanOrEqual(CAPPED_HEIGHT);

    expect(m.body.flexDirection).toBe('column');
    expect(m.body.overflowY).toBe('auto');

    expect(m.preview.clientHeight).toBeLessThanOrEqual(288); // max-lg:max-h-72
    expect(m.preview.scrollHeight).toBeGreaterThan(m.preview.clientHeight);
    expect(m.list.clientHeight).toBeLessThanOrEqual(240); // max-lg:max-h-60
    expect(m.list.scrollHeight).toBeGreaterThan(m.list.clientHeight);
  });

  it('styles the other scoping root, and nothing outside either of them', async () => {
    const m = await measure(WIDE);

    // `.bk-root` is a scoping root too, and the builder shell puts its whole
    // layout on that same element.
    expect(m.builderRoot.display).toBe('flex');
    expect(m.builderRoot.flexDirection).toBe('column');
    expect(m.builderRoot.overflow).toBe('hidden');

    // Scoping still holds: the utilities never reach the host document.
    expect(m.outside.maxHeight).toBe('none');
    expect(m.outside.display).toBe('block');
  });
});
