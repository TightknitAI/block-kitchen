/**
 * Shared plumbing for the tests that measure real layout in a real browser.
 *
 * Both of them need the same two things — the package stylesheet compiled the
 * way `pnpm build:css` compiles it, and a Chromium to load it into — and both
 * are checking for regressions that only exist in the *built* artifact
 * (`@scope`, cascade layers, `svh` units, actual box geometry). jsdom can see
 * none of it.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Browser, chromium } from 'playwright';

// Vitest runs from the package root, and `import.meta.url` is a dev-server URL
// under the jsdom environment rather than a file one.
const REPO_ROOT = process.cwd();

/**
 * Compile the package stylesheet exactly as `pnpm build:css` does, into a temp
 * file so a stale (or missing) `dist/` can neither mask a regression nor be
 * clobbered by the test run.
 * @returns the built, scoped stylesheet
 */
export function buildStylesheet(): string {
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
 * Launch the Chromium these tests measure in. `BK_CHROMIUM_EXECUTABLE` lets a
 * pre-provisioned image point at its own binary; CI uses `playwright install
 * chromium` and needs no override.
 * @returns the launched browser
 */
export function launchChromium(): Promise<Browser> {
  const executablePath = process.env.BK_CHROMIUM_EXECUTABLE;
  return chromium.launch(executablePath ? { executablePath } : {});
}
