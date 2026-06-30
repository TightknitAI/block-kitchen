#!/usr/bin/env node
// Installs git hooks into the shared common hooks dir (used by all worktrees).
//
// Why not `lefthook install`? Its generated shim bakes an absolute path to
// whichever worktree last ran it, and falls through to `mint run
// csjones/lefthook-plugin` when that path is stale. On a machine where `mint`
// is Mintlify's CLI (not Swift Mint) that branch errors mid-run and lefthook's
// stage_fixed stash can silently revert uncommitted edits in a fresh worktree.
//
// These hooks instead resolve each worktree's OWN node_modules/.bin/lefthook,
// and skip cleanly (exit 0, no stash, no mint) when deps aren't installed.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let hooksDir;
try {
  const common = execFileSync("git", ["rev-parse", "--git-common-dir"], {
    encoding: "utf8",
  }).trim();
  hooksDir = join(common, "hooks");
} catch {
  // Not a git repo (e.g. installed as a published dependency) — nothing to do.
  process.exit(0);
}

const hook = (name) => `#!/bin/sh
# Managed by scripts/install-hooks.mjs — do not edit by hand.
root="$(git rev-parse --show-toplevel)"
bin="$root/node_modules/.bin/lefthook"
if [ ! -x "$bin" ]; then
  echo "lefthook: node_modules not installed in this worktree; skipping ${name}." >&2
  echo "          run 'pnpm install' here to enable git hooks." >&2
  exit 0
fi
exec "$bin" run ${name} "$@"
`;

mkdirSync(hooksDir, { recursive: true });
for (const name of ["pre-commit", "pre-push"]) {
  const file = join(hooksDir, name);
  writeFileSync(file, hook(name));
  chmodSync(file, 0o755);
}
