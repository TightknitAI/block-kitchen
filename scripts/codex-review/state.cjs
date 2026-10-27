/**
 * The review state hidden in the sticky review comment. render.cjs writes it;
 * prepare.cjs reads it back from the PR's comments, so the next review can check
 * the findings this one left open and keep their IDs.
 *
 * A complete review also hides what it covers: a fingerprint of everything the
 * reviewer read, and the newest comment it read. An unavailable notice records
 * only the comment, and a retired review neither, so whatever runs next reviews again.
 */

const COMMENT_MARKER = '<!-- codex-review -->';
/** The account the post_feedback job comments as. */
const REVIEW_AUTHOR = 'github-actions[bot]';
const STATE_VERSION = 2;
const STATE_BLOCK = /<!-- CODEX_REVIEW_STATE\n([^\n]*)\n-->/;
const COVERAGE_BLOCK = /<!-- CODEX_REVIEW_COVERS\n([^\n]*)\n-->/;
const SHA = /^[0-9a-f]{7,64}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;
const FINDING_ID = /^F([1-9]\d*)$/;
/** Dismissed findings kept in the state, newest last. */
const MAX_DISMISSED = 20;

/** The state to start from when the PR has no earlier review. */
const NO_PREVIOUS_REVIEW = Object.freeze({
  head_sha: null,
  base_sha: null,
  next_id: 1,
  findings: Object.freeze([]),
  dismissed: Object.freeze([])
});

/**
 * Tests a value that must be a string against a pattern. `RegExp#test` alone
 * would coerce a value such as `['F1']` into a match.
 * @param {RegExp} pattern - The pattern.
 * @param {unknown} value - The value.
 * @returns {boolean} True when the value is a matching string.
 */
const matches = (pattern, value) =>
  typeof value === 'string' && pattern.test(value);

/**
 * Serializes a value into a hidden HTML comment. `<` and `>` are escaped so no
 * value can close the comment early, and `@` so none mentions anyone.
 * @param {string} name - The block's name.
 * @param {object} value - The value to hide.
 * @returns {string} The hidden block.
 */
const renderHidden = (name, value) =>
  `<!-- ${name}\n${JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/@/g, '\\u0040')}\n-->`;

/**
 * Serializes the review state into a hidden HTML comment.
 * @param {object} state - Review state.
 * @returns {string} The hidden state block.
 */
const renderState = (state) => renderHidden('CODEX_REVIEW_STATE', state);

/**
 * Serializes what a review covers into a hidden HTML comment.
 * @param {{ fingerprint: string | null, replies_through: number | null }} coverage - The review's coverage; no fingerprint when the review is unavailable.
 * @returns {string} The hidden coverage block.
 */
const renderCoverage = (coverage) =>
  renderHidden('CODEX_REVIEW_COVERS', coverage);

/**
 * Serializes the findings the publishing job turns into inline comments.
 * @param {object} findings - Sanitized findings and the reviewed commit.
 * @returns {string} The hidden findings block.
 */
const renderFindings = (findings) =>
  renderHidden('CODEX_REVIEW_FINDINGS', findings);

/**
 * Reads the JSON of a hidden block from a comment body.
 * @param {RegExp} pattern - The block's pattern.
 * @param {string} body - The comment body.
 * @returns {unknown} The parsed value, or null when there is no parseable block.
 */
const readHidden = (pattern, body) => {
  const block = pattern.exec(body.replace(/\r\n/g, '\n'));
  if (!block) {
    return null;
  }
  try {
    return JSON.parse(block[1]);
  } catch {
    return null;
  }
};

/**
 * Reads one stored finding. Version 1 stored no problem and no `raised_in`.
 * @param {unknown} value - One entry of the state's `findings`.
 * @param {string} reviewedSha - The commit the state was written for; the `raised_in` when none is stored.
 * @returns {{ id: string, file: string, line: number | null, category: string | null, severity: string | null, title: string, problem: string | null, raised_in: string } | null}
 *   The finding, or null when it is malformed.
 */
const readStoredFinding = (value, reviewedSha) => {
  if (
    !value ||
    typeof value !== 'object' ||
    !matches(FINDING_ID, value.id) ||
    typeof value.file !== 'string' ||
    typeof value.title !== 'string'
  ) {
    return null;
  }
  const stringOrNull = (key) =>
    typeof value[key] === 'string' ? value[key] : null;
  return {
    id: value.id,
    file: value.file,
    line: Number.isInteger(value.line) && value.line > 0 ? value.line : null,
    category: stringOrNull('category'),
    severity: stringOrNull('severity'),
    title: value.title,
    problem: stringOrNull('problem'),
    raised_in: matches(SHA, value.raised_in) ? value.raised_in : reviewedSha
  };
};

/**
 * Reads one finding a person explained away.
 * @param {unknown} value - One entry of the state's `dismissed`.
 * @returns {{ id: string, file: string, title: string, reason: string } | null} The finding, or null when it is malformed.
 */
const readDismissed = (value) => {
  if (
    !value ||
    typeof value !== 'object' ||
    !matches(FINDING_ID, value.id) ||
    typeof value.file !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.reason !== 'string'
  ) {
    return null;
  }
  return {
    id: value.id,
    file: value.file,
    title: value.title,
    reason: value.reason
  };
};

/**
 * Keeps the first entry for each ID.
 * @param {({ id: string } | null)[]} entries - Entries, some of them null.
 * @returns {{ id: string }[]} The entries without nulls or repeated IDs.
 */
const uniqueById = (entries) => {
  const kept = new Map();
  for (const entry of entries) {
    if (entry && !kept.has(entry.id)) {
      kept.set(entry.id, entry);
    }
  }
  return [...kept.values()];
};

/**
 * Reads the review state from a review comment body. Anyone with write access
 * can edit the comment, so every field is checked.
 * @param {string} body - The comment body.
 * @returns {{ head_sha: string, base_sha: string | null, next_id: number, findings: ReturnType<typeof readStoredFinding>[], dismissed: ReturnType<typeof readDismissed>[] } | null}
 *   The state, or null when the body carries no valid one.
 */
const parseState = (body) => {
  const state = readHidden(STATE_BLOCK, body);
  if (
    !state ||
    typeof state !== 'object' ||
    ![1, STATE_VERSION].includes(state.version) ||
    !matches(SHA, state.head_sha) ||
    !Array.isArray(state.findings)
  ) {
    return null;
  }
  const findings = uniqueById(
    state.findings.map((value) => readStoredFinding(value, state.head_sha))
  );
  const dismissed = Array.isArray(state.dismissed)
    ? uniqueById(state.dismissed.map(readDismissed)).slice(-MAX_DISMISSED)
    : [];
  const firstUnused =
    Math.max(
      0,
      ...[...findings, ...dismissed].map((finding) =>
        Number(finding.id.slice(1))
      )
    ) + 1;
  return {
    head_sha: state.head_sha,
    base_sha: matches(SHA, state.base_sha) ? state.base_sha : null,
    next_id:
      Number.isSafeInteger(state.next_id) && state.next_id >= firstUnused
        ? state.next_id
        : firstUnused,
    findings,
    dismissed
  };
};

/**
 * Reads what a review covers from its comment body.
 * @param {string} body - The comment body.
 * @returns {{ fingerprint: string | null, replies_through: number | null } | null}
 *   The coverage, with no fingerprint for an unavailable notice, or null when the body carries none, as a retired review doesn't.
 */
const parseCoverage = (body) => {
  const coverage = readHidden(COVERAGE_BLOCK, body);
  if (!coverage || typeof coverage !== 'object') {
    return null;
  }
  const fingerprint = matches(FINGERPRINT, coverage.fingerprint)
    ? coverage.fingerprint
    : null;
  const repliesThrough =
    Number.isSafeInteger(coverage.replies_through) &&
    coverage.replies_through > 0
      ? coverage.replies_through
      : null;
  if (fingerprint === null && repliesThrough === null) {
    return null;
  }
  return { fingerprint, replies_through: repliesThrough };
};

/**
 * Finds the latest review comment the workflow posted, which is also the one the next review replaces.
 * @param {object[]} comments - The PR's issue comments, oldest first, as the GitHub API returns them.
 * @returns {object | undefined} The comment, or undefined when there is none.
 */
const latestReviewComment = (comments) =>
  comments
    .filter(
      (comment) =>
        comment?.user?.login === REVIEW_AUTHOR &&
        typeof comment.body === 'string' &&
        comment.body.startsWith(COMMENT_MARKER)
    )
    .at(-1);

/**
 * Finds the state of the last review.
 * @param {object[]} comments - The PR's issue comments, oldest first, as the GitHub API returns them.
 * @returns {NonNullable<ReturnType<typeof parseState>> | typeof NO_PREVIOUS_REVIEW}
 *   The state, or NO_PREVIOUS_REVIEW when there is no review comment or it carries no state.
 */
const findPreviousReview = (comments) => {
  const latest = latestReviewComment(comments);
  return (latest && parseState(latest.body)) ?? NO_PREVIOUS_REVIEW;
};

/**
 * Finds what the review on the PR covers.
 * @param {object[]} comments - The PR's issue comments, oldest first, as the GitHub API returns them.
 * @returns {ReturnType<typeof parseCoverage>} The coverage, or null when there is no review comment or it records none.
 */
const findCoverage = (comments) => {
  const latest = latestReviewComment(comments);
  return latest ? parseCoverage(latest.body) : null;
};

module.exports = {
  COMMENT_MARKER,
  MAX_DISMISSED,
  NO_PREVIOUS_REVIEW,
  STATE_VERSION,
  findCoverage,
  findPreviousReview,
  latestReviewComment,
  parseCoverage,
  parseState,
  renderCoverage,
  renderFindings,
  renderState
};
