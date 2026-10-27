/**
 * Picks the repository rule docs that apply to a set of changed files, so the
 * automated PR reviewer reads only the rules for the code a pull request
 * touches.
 *
 * Every rule doc, root (`docs/rules/**\/*.md`) or package
 * (`<package>/docs/rules/**\/*.md`), declares the files it governs in a
 * `paths:` frontmatter list of repo-relative globs; `paths: []` marks a rule
 * that never applies to code review. A package's rule globs stay inside the
 * package. A package's AGENTS.md applies to every change inside that package.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_RULES_DIR = 'docs/rules';

/**
 * Parses the `paths:` list from a Markdown file's YAML frontmatter. Supports a
 * block list (`- "glob"` lines) and an inline JSON-style list such as `[]`.
 * @param {string} content - Raw Markdown file content.
 * @returns {string[] | null} The globs, or null when the frontmatter has no `paths:` key.
 */
const parseRulePaths = (content) => {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return null;
  }
  const end = lines.indexOf('---', 1);
  if (end === -1) {
    throw new Error('frontmatter is not closed with a `---` line');
  }
  const frontmatter = lines.slice(1, end);
  const keyIndex = frontmatter.findIndex((line) => /^paths:/.test(line));
  if (keyIndex === -1) {
    return null;
  }

  const inline = frontmatter[keyIndex].slice('paths:'.length).trim();
  if (inline.startsWith('[')) {
    let parsed;
    try {
      parsed = JSON.parse(inline);
    } catch {
      throw new Error(`\`paths:\` inline list is not valid JSON: ${inline}`);
    }
    if (
      !Array.isArray(parsed) ||
      !parsed.every((glob) => typeof glob === 'string')
    ) {
      throw new Error('`paths:` must be a list of glob strings');
    }
    return parsed;
  }
  if (inline !== '') {
    throw new Error(
      '`paths:` must be a list of glob strings, not a single value'
    );
  }

  const globs = [];
  for (const line of frontmatter.slice(keyIndex + 1)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (!item) {
      break;
    }
    globs.push(item[1].trim().replace(/^(['"])(.*)\1$/, '$2'));
  }
  if (globs.length === 0) {
    throw new Error(
      '`paths:` has no items; write `paths: []` for a rule that never applies to code review'
    );
  }
  return globs;
};

/**
 * Lists every Markdown file under a directory, recursively.
 * @param {string} rootDir - Repository root.
 * @param {string} dir - Directory relative to the repository root.
 * @returns {string[]} Sorted repo-relative paths; empty when the directory does not exist.
 */
const listMarkdownFiles = (rootDir, dir) => {
  const absolute = path.join(rootDir, dir);
  if (!fs.existsSync(absolute)) {
    return [];
  }
  return fs
    .readdirSync(absolute, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) =>
      path
        .relative(rootDir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/')
    )
    .sort();
};

/**
 * Reads every rule doc under a rules directory and its `paths:` globs.
 * @param {string} rootDir - Repository root.
 * @param {string} rulesDir - Rules directory relative to the repository root.
 * @returns {{ path: string, globs: string[] | null, error: string | null }[]} One entry per rule doc.
 */
const readRules = (rootDir, rulesDir) =>
  listMarkdownFiles(rootDir, rulesDir).map((rulePath) => {
    try {
      const globs = parseRulePaths(
        fs.readFileSync(path.join(rootDir, rulePath), 'utf8')
      );
      return { path: rulePath, globs, error: null };
    } catch (error) {
      return { path: rulePath, globs: null, error: error.message };
    }
  });

/**
 * Reads every root rule doc and its `paths:` globs.
 * @param {string} rootDir - Repository root.
 * @returns {ReturnType<typeof readRules>} One entry per rule doc.
 */
const readRootRules = (rootDir) => readRules(rootDir, ROOT_RULES_DIR);

/**
 * Reads a package's rule docs and their `paths:` globs.
 * @param {string} rootDir - Repository root.
 * @param {string} packageDir - Package directory relative to the repository root.
 * @returns {ReturnType<typeof readRules>} One entry per rule doc; empty when the package has none.
 */
const readPackageRules = (rootDir, packageDir) =>
  readRules(rootDir, `${packageDir}/${ROOT_RULES_DIR}`);

/**
 * Tests whether a repo-relative file path matches any of the globs. `**` skips
 * dotfiles and dot-directories at any depth, which must be listed explicitly.
 * @param {string} file - Repo-relative file path.
 * @param {string[]} globs - Repo-relative glob patterns.
 * @returns {boolean} True when at least one glob matches.
 */
const matchesAny = (file, globs) =>
  globs.some((glob) => path.matchesGlob(file, glob));

/**
 * Finds the directories between a file and the repository root that carry
 * their own rule docs or an AGENTS.md. The root itself is excluded: root rules
 * route by `paths:` and root AGENTS.md is always loaded.
 * @param {string} rootDir - Repository root.
 * @param {string} file - Repo-relative file path.
 * @returns {string[]} Ancestor directories, nearest first.
 */
const packageAncestors = (rootDir, file) => {
  const ancestors = [];
  for (
    let dir = path.posix.dirname(file);
    dir !== '.';
    dir = path.posix.dirname(dir)
  ) {
    const hasRules = fs.existsSync(path.join(rootDir, dir, ROOT_RULES_DIR));
    const hasAgentsMd = fs.existsSync(path.join(rootDir, dir, 'AGENTS.md'));
    if (hasRules || hasAgentsMd) {
      ancestors.push(dir);
    }
  }
  return ancestors;
};

/**
 * Builds the list of rule docs that apply to a pull request's changed files.
 * @param {{ rootDir: string, files: string[] }} args - Repository root and repo-relative changed files.
 * @returns {{ rules: { path: string, reason: string, bytes: number }[], totalBytes: number, unrouted: string[] }}
 *   The applicable rules with why each was picked, their combined size, and rules skipped for lacking a valid `paths:` list.
 */
const buildRuleManifest = ({ rootDir, files }) => {
  const reasons = new Map();
  const addRule = (rulePath, reason) => {
    if (!reasons.has(rulePath)) {
      reasons.set(rulePath, reason);
    }
  };

  const unrouted = [];
  const routeRules = (rules) => {
    for (const rule of rules) {
      if (!rule.globs) {
        unrouted.push(rule.path);
        continue;
      }
      const matched = files.find((file) => matchesAny(file, rule.globs));
      if (matched) {
        addRule(rule.path, `paths match ${matched}`);
      }
    }
  };

  routeRules(readRootRules(rootDir));

  const packageDirs = new Set();
  for (const file of files) {
    for (const dir of packageAncestors(rootDir, file)) {
      const agentsMd = `${dir}/AGENTS.md`;
      if (fs.existsSync(path.join(rootDir, agentsMd))) {
        addRule(agentsMd, `package instructions for ${file}`);
      }
      packageDirs.add(dir);
    }
  }
  for (const dir of [...packageDirs].sort()) {
    routeRules(readPackageRules(rootDir, dir));
  }

  const rules = [...reasons.entries()]
    .map(([rulePath, reason]) => ({
      path: rulePath,
      reason,
      bytes: fs.statSync(path.join(rootDir, rulePath)).size
    }))
    .sort((a, b) => (a.path < b.path ? -1 : 1));
  return {
    rules,
    totalBytes: rules.reduce((total, rule) => total + rule.bytes, 0),
    unrouted
  };
};

module.exports = {
  buildRuleManifest,
  matchesAny,
  parseRulePaths,
  readPackageRules,
  readRootRules
};
