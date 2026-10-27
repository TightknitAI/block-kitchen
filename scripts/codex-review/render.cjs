/**
 * Turns the reviewer's JSON output into the body of the sticky review comment.
 * The model only proposes findings: which ones are kept, their order and IDs,
 * the status line, and the hidden review state are decided here from trusted
 * workflow values. A review a reply asked for only re-checks earlier findings.
 * Runs in the render_review job, which has no write access; the post_feedback
 * job publishes the body without running any repository code.
 *
 * Usage: node scripts/codex-review/render.cjs --context-dir <dir>
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  COMMENT_MARKER,
  MAX_DISMISSED,
  NO_PREVIOUS_REVIEW,
  STATE_VERSION,
  renderCoverage,
  renderFindings,
  renderState
} = require('./state.cjs');

const COMMENT_HEADING = '### 🦦 Lontra AI Reviewer';
/** Every review comment opens with the marker, the heading and a divider under it. */
const TITLE_LINES = [COMMENT_MARKER, COMMENT_HEADING, '', '---', ''];
const MAX_FINDINGS = 5;
const MAX_NOTES = 5;
const MAX_ACTION_ITEMS = 3;
const CATEGORIES = [
  'security',
  'data_loss',
  'bug',
  'performance',
  'architecture'
];
const SEVERITIES = ['critical', 'high', 'medium'];
const RESOLVED_STATUSES = ['fixed', 'withdrawn', 'dismissed'];
const TRIGGERS = ['push', 'manual', 'command', 'reply'];
const FINGERPRINT = /^[0-9a-f]{64}$/;
/** What a run reviewed when its evidence predates run.json: a push, with no coverage to record. */
const NO_RUN = Object.freeze({
  trigger: 'push',
  fingerprint: null,
  replies_through: null
});
const CATEGORY_LABELS = {
  security: 'Security',
  data_loss: 'Data loss',
  bug: 'Bug',
  performance: 'Performance',
  architecture: 'Architecture'
};
const LENGTH_LIMITS = {
  summary: 1500,
  title: 200,
  problem: 1500,
  fix: 1000,
  tldr: 600,
  action_item: 200,
  rule: 200,
  reason: 500
};

const isString = (value) => typeof value === 'string';
const isLine = (value) => Number.isInteger(value) && value > 0;
const isOptionalLine = (value) => value === null || isLine(value);

/**
 * Describes what is wrong with one proposed finding.
 * @param {unknown} finding - One entry of the reviewer's `findings` array.
 * @returns {string | null} The problem, or null when the finding is well formed.
 */
const findingProblem = (finding) => {
  if (!finding || typeof finding !== 'object') {
    return 'not an object';
  }
  for (const key of ['file', 'title', 'problem', 'fix']) {
    if (!isString(finding[key])) {
      return `\`${key}\` must be a string`;
    }
  }
  if (!isLine(finding.line)) {
    return '`line` must be a positive integer';
  }
  if (!CATEGORIES.includes(finding.category)) {
    return 'unknown `category`';
  }
  if (!SEVERITIES.includes(finding.severity)) {
    return 'unknown `severity`';
  }
  if (!(finding.rule === null || isString(finding.rule))) {
    return '`rule` must be a string or null';
  }
  if (!(finding.tldr === undefined || isString(finding.tldr))) {
    return '`tldr` must be a string';
  }
  if (
    !(
      finding.action_items === undefined ||
      (Array.isArray(finding.action_items) &&
        finding.action_items.every(isString))
    )
  ) {
    return '`action_items` must be an array of strings';
  }
  if (
    !(
      finding.previous_id === undefined ||
      finding.previous_id === null ||
      isString(finding.previous_id)
    )
  ) {
    return '`previous_id` must be a string or null';
  }
  return null;
};

/**
 * Parses and validates the reviewer's final message against the output schema.
 * @param {string | undefined} raw - The reviewer's final message.
 * @returns {{ review?: { summary: string, findings: object[], notes: object[], resolved: object[] }, error?: string }}
 *   The review, with `previous_id`, `tldr` and `action_items` on every finding, or why it was rejected.
 */
const parseReviewOutput = (raw) => {
  if (!raw || !raw.trim()) {
    return { error: 'the reviewer returned no output' };
  }
  let review;
  try {
    review = JSON.parse(raw);
  } catch {
    return { error: 'the reviewer output is not valid JSON' };
  }
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    return { error: 'the reviewer output is not a JSON object' };
  }
  if (
    !isString(review.summary) ||
    !Array.isArray(review.findings) ||
    !Array.isArray(review.notes)
  ) {
    return {
      error: 'the reviewer output needs `summary`, `findings` and `notes`'
    };
  }
  // The prompt and schema come from the PR head, so a branch older than
  // `resolved`, `previous_id`, `tldr` or `action_items` gets output without them.
  const resolved = review.resolved ?? [];
  if (!Array.isArray(resolved)) {
    return { error: '`resolved` must be an array' };
  }
  for (const [index, finding] of review.findings.entries()) {
    const problem = findingProblem(finding);
    if (problem) {
      return { error: `finding ${index + 1}: ${problem}` };
    }
  }
  for (const [index, note] of review.notes.entries()) {
    if (
      !note ||
      !isString(note.file) ||
      !isString(note.text) ||
      !isOptionalLine(note.line)
    ) {
      return { error: `note ${index + 1} is malformed` };
    }
  }
  for (const [index, entry] of resolved.entries()) {
    if (
      !entry ||
      !isString(entry.id) ||
      !RESOLVED_STATUSES.includes(entry.status) ||
      !isString(entry.reason)
    ) {
      return { error: `resolved entry ${index + 1} is malformed` };
    }
  }
  return {
    review: {
      ...review,
      findings: review.findings.map((finding) => ({
        ...finding,
        previous_id: finding.previous_id ?? null,
        tldr: finding.tldr ?? null,
        action_items: finding.action_items ?? []
      })),
      resolved
    }
  };
};

/**
 * Orders findings by severity, then category, so a critical bug outranks a medium security nit.
 * @param {{ category: string, severity: string }} finding - A validated finding.
 * @returns {number} Lower sorts first.
 */
const rank = (finding) =>
  SEVERITIES.indexOf(finding.severity) * CATEGORIES.length +
  CATEGORIES.indexOf(finding.category);

/**
 * Tells whether a finding blocks the pull request: any security or data-loss
 * problem, or anything critical.
 * @param {{ category: string, severity: string }} finding - A validated finding.
 * @returns {boolean} True when the finding blocks.
 */
const isBlocking = (finding) =>
  finding.category === 'security' ||
  finding.category === 'data_loss' ||
  finding.severity === 'critical';

/**
 * Keeps the most important in-scope findings, turns the overflow into notes, and
 * matches them to the findings the last review left open. Blocking findings and
 * repeats of earlier ones are always kept, even past the cap, so neither turns
 * into a note: one the status ignores, the other one that looks resolved. A
 * review a reply asked for keeps only repeats, since the code is unchanged.
 * @param {{ findings: object[], notes: object[], resolved: object[] }} review - A validated review.
 * @param {string[]} prFiles - The files the pull request changes.
 * @param {typeof NO_PREVIOUS_REVIEW} [previous] - The last review's state.
 * @param {{ replyOnly?: boolean }} [options] - `replyOnly` when a reply asked for the review.
 * @returns {{ findings: object[], notes: object[], outOfScope: object[], resolved: object[], dismissed: object[], nextId: number }}
 *   Findings (a repeat keeps its earlier ID and has it as `earlier`) and notes with IDs, the findings about
 *   files outside the PR, the earlier findings that no longer apply, every finding a person explained away
 *   so far, and the first finding number still unused.
 */
const applyBudget = (
  review,
  prFiles,
  previous = NO_PREVIOUS_REVIEW,
  { replyOnly = false } = {}
) => {
  const inScope = new Set(prFiles);
  const earlierById = new Map(
    previous.findings.map((finding) => [finding.id, finding])
  );
  const repeated = new Set();
  const ranked = review.findings
    .filter((finding) => inScope.has(finding.file))
    .sort((a, b) => rank(a) - rank(b))
    .map((finding) => {
      const earlier = earlierById.get(finding.previous_id);
      if (!earlier || repeated.has(earlier.id)) {
        return { ...finding, earlier: null };
      }
      repeated.add(earlier.id);
      return { ...finding, earlier };
    });
  const alwaysKept = (finding) =>
    finding.earlier !== null || (!replyOnly && isBlocking(finding));
  const otherSlots = replyOnly
    ? 0
    : Math.max(0, MAX_FINDINGS - ranked.filter(alwaysKept).length);
  const keptOthers = new Set(
    ranked.filter((finding) => !alwaysKept(finding)).slice(0, otherSlots)
  );
  const isKept = (finding) => alwaysKept(finding) || keptOthers.has(finding);
  let nextId = previous.next_id;
  const findings = ranked.filter(isKept).map((finding) => {
    if (finding.earlier) {
      return { ...finding, id: finding.earlier.id };
    }
    const id = `F${nextId}`;
    nextId += 1;
    return { ...finding, id };
  });
  const verdicts = new Map();
  for (const entry of review.resolved) {
    if (!verdicts.has(entry.id)) {
      verdicts.set(entry.id, entry);
    }
  }
  const resolved = previous.findings
    .filter((finding) => !repeated.has(finding.id))
    .map((finding) => ({
      id: finding.id,
      file: finding.file,
      title: finding.title,
      status: verdicts.get(finding.id)?.status ?? 'unreported',
      reason: verdicts.get(finding.id)?.reason ?? null
    }));
  const dismissed = [
    ...(previous.dismissed ?? []),
    ...resolved
      .filter((entry) => entry.status === 'dismissed')
      .map(({ id, file, title, reason }) => ({ id, file, title, reason }))
  ].slice(-MAX_DISMISSED);
  const overflow = ranked
    .filter((finding) => !isKept(finding))
    .map((finding) => ({
      file: finding.file,
      line: finding.line,
      text: `${finding.title} (${CATEGORY_LABELS[finding.category].toLowerCase()}; ${replyOnly ? 'new, and a review a reply asked for only re-checks earlier findings' : `over the ${MAX_FINDINGS}-finding limit`})`
    }));
  const candidates = [
    ...overflow,
    ...review.notes.filter((note) => inScope.has(note.file))
  ];
  return {
    findings,
    notes: candidates
      .slice(0, MAX_NOTES)
      .map((note, index) => ({ ...note, id: `N${index + 1}` })),
    outOfScope: review.findings.filter((finding) => !inScope.has(finding.file)),
    resolved,
    dismissed,
    nextId
  };
};

/**
 * Derives the status line from the kept findings.
 * @param {{ category: string, severity: string }[]} findings - Kept findings.
 * @returns {'ship_it' | 'small_fixes' | 'needs_work'} The review status.
 */
const statusFor = (findings) => {
  if (findings.length === 0) {
    return 'ship_it';
  }
  return findings.some(isBlocking) ? 'needs_work' : 'small_fixes';
};

/**
 * Shortens text to a maximum length.
 * @param {string} text - Text to shorten.
 * @param {number} limit - Maximum length.
 * @returns {string} The text, ending in an ellipsis when it was cut.
 */
const truncate = (text, limit) =>
  text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

/**
 * Removes what model-written text must not carry into the comment: HTML
 * comment markers, which could forge or hide review state, and @mentions.
 * @param {string} text - Model-written text.
 * @returns {string} Text without comment markers or live mentions.
 */
const neutralize = (text) =>
  text.replace(/<!--|--!?>/g, '').replace(/@(?=[\w-])/g, '@\u2060');

/**
 * Makes model-written text safe to embed in the comment.
 * @param {string} text - Model-written text.
 * @param {number} limit - Maximum length.
 * @returns {string} Sanitized text.
 */
const sanitize = (text, limit) => truncate(neutralize(text).trim(), limit);

/**
 * Sanitizes text that must stay on one line.
 * @param {string} text - Model-written text.
 * @param {number} limit - Maximum length.
 * @returns {string} Sanitized single-line text.
 */
const sanitizeLine = (text, limit) =>
  truncate(neutralize(text).replace(/\s+/g, ' ').trim(), limit);

/**
 * Formats when a comment was written, in UTC to the minute.
 * @param {Date} date - The time.
 * @returns {string} For example `2026-09-28 15:42 UTC`.
 */
const formatUpdatedAt = (date) =>
  `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/**
 * Renders the sticky review comment.
 * @param {{ review: object, budget: ReturnType<typeof applyBudget>, run?: ReturnType<typeof readRun>, headSha: string, baseSha: string }} args
 *   Review, budgeted findings, what this run reviewed, and trusted commit values.
 * @returns {string} Comment body.
 */
const renderComment = ({ review, budget, run = NO_RUN, headSha, baseSha }) => {
  const lines = [
    ...TITLE_LINES,
    ...(budget.findings.length === 0
      ? ['No open issues.', '']
      : budget.findings.flatMap((finding) => [
          `- **${finding.id}: ${sanitizeLine(finding.title, LENGTH_LIMITS.title)}**`,
          ''
        ]))
  ];
  lines.push(
    renderState({
      version: STATE_VERSION,
      head_sha: headSha,
      base_sha: baseSha,
      next_id: budget.nextId,
      findings: budget.findings.map((finding) => ({
        id: finding.id,
        file: finding.file,
        line: finding.line,
        category: finding.category,
        severity: finding.severity,
        title: sanitizeLine(finding.title, LENGTH_LIMITS.title),
        problem: sanitize(finding.problem, LENGTH_LIMITS.problem),
        raised_in: finding.earlier?.raised_in ?? headSha
      })),
      dismissed: budget.dismissed.map((entry) => ({
        id: entry.id,
        file: entry.file,
        title: sanitizeLine(entry.title, LENGTH_LIMITS.title),
        reason: sanitizeLine(entry.reason ?? '', LENGTH_LIMITS.reason)
      }))
    }),
    renderFindings({
      version: 1,
      head_sha: headSha,
      summary: sanitize(review.summary, LENGTH_LIMITS.summary),
      findings: budget.findings.map((finding) => ({
        id: finding.id,
        file: finding.file,
        line: finding.line,
        category: finding.category,
        severity: finding.severity,
        title: sanitizeLine(finding.title, LENGTH_LIMITS.title),
        problem: sanitize(finding.problem, LENGTH_LIMITS.problem),
        fix: sanitize(finding.fix, LENGTH_LIMITS.fix),
        // A blank TLDR or action item only drops its section; rejecting it would discard the whole review.
        tldr: sanitizeLine(finding.tldr ?? '', LENGTH_LIMITS.tldr) || null,
        action_items: finding.action_items
          .map((item) => sanitizeLine(item, LENGTH_LIMITS.action_item))
          .filter(Boolean)
          .slice(0, MAX_ACTION_ITEMS),
        rule: finding.rule
          ? sanitizeLine(finding.rule, LENGTH_LIMITS.rule).replace(/`/g, '')
          : null
      }))
    })
  );
  if (run.fingerprint || run.replies_through !== null) {
    lines.push(
      renderCoverage({
        fingerprint: run.fingerprint,
        replies_through: run.replies_through
      })
    );
  }
  return lines.join('\n');
};

/**
 * Renders the comment shown when no valid review is available. It carries the
 * last review's state forward, so the next review still checks what that one left
 * open, and records the comments this run read but no fingerprint, so the next push reviews.
 * @param {{ reason: string, headSha: string, runUrl: string, previous: typeof NO_PREVIOUS_REVIEW, run?: ReturnType<typeof readRun>, updatedAt: Date }} args
 *   Why, the commit, the run link, the last review's state, what this run read, and the render time.
 * @returns {string} Comment body.
 */
const renderUnavailable = ({
  reason,
  headSha,
  runUrl,
  previous,
  run = NO_RUN,
  updatedAt
}) => {
  const lines = [
    ...TITLE_LINES,
    `**Status:** ⚠️ Review unavailable for \`${headSha.slice(0, 8)}\` · [run](${runUrl})`,
    `**Updated at:** ${formatUpdatedAt(updatedAt)}`,
    '',
    `${sanitizeLine(reason, 300)}. The next push reviews the PR again, or comment \`/lontra-review\` to review it now.`,
    ''
  ];
  if (previous.head_sha !== null) {
    if (previous.findings.length > 0) {
      lines.push(
        `Still open from the review of \`${previous.head_sha.slice(0, 8)}\`: ${previous.findings.map((finding) => finding.id).join(', ')}.`,
        ''
      );
    }
    lines.push(renderState({ version: STATE_VERSION, ...previous }));
  }
  if (run.replies_through !== null) {
    lines.push(
      renderCoverage({
        fingerprint: null,
        replies_through: run.replies_through
      })
    );
  }
  return lines.join('\n');
};

/**
 * Reads the last review's state, which prepare.cjs saved with the evidence.
 * @param {string} contextDir - The evidence directory.
 * @returns {typeof NO_PREVIOUS_REVIEW} The state.
 */
const readPreviousReview = (contextDir) => {
  const file = path.join(contextDir, 'previous-review.json');
  // Evidence from a PR branch whose prepare.cjs predates this file has none.
  if (!fs.existsSync(file)) {
    return NO_PREVIOUS_REVIEW;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};

/**
 * Reads what this run reviewed and why, which prepare.cjs saved with the
 * evidence. The evidence comes from the PR's checkout, so each field is checked.
 * @param {string} contextDir - The evidence directory.
 * @returns {{ trigger: string, fingerprint: string | null, replies_through: number | null }} The run.
 */
const readRun = (contextDir) => {
  const file = path.join(contextDir, 'run.json');
  if (!fs.existsSync(file)) {
    return NO_RUN;
  }
  const run = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    trigger: TRIGGERS.includes(run?.trigger) ? run.trigger : 'push',
    fingerprint:
      typeof run?.fingerprint === 'string' && FINGERPRINT.test(run.fingerprint)
        ? run.fingerprint
        : null,
    replies_through:
      Number.isSafeInteger(run?.replies_through) && run.replies_through > 0
        ? run.replies_through
        : null
  };
};

/**
 * Counts the comments people wrote that the reviewer read.
 * @param {string} contextDir - The evidence directory.
 * @returns {number} The count; 0 when the evidence predates replies.json.
 */
const countReplies = (contextDir) => {
  const file = path.join(contextDir, 'replies.json');
  if (!fs.existsSync(file)) {
    return 0;
  }
  const replies = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(replies) ? replies.length : 0;
};

/**
 * Prints text to the job log with workflow commands turned off, so a line of
 * model output such as `::add-mask::` is printed, not run.
 * @param {string} text - Text that may contain model output.
 */
const logData = (text) => {
  const token = crypto.randomBytes(16).toString('hex');
  // secrets-in-logs-allow: a one-off stop-commands marker, not a credential.
  console.log(`::stop-commands::${token}\n${text}\n::${token}::`);
};

/**
 * Builds the comment body from the workflow's job results and evidence files.
 * @param {{ env: Record<string, string | undefined>, contextDir: string, now?: Date }} args - Workflow env, the evidence directory, and the render time.
 * @returns {string} Comment body.
 */
const buildCommentBody = ({ env, contextDir, now = new Date() }) => {
  const headSha = env.HEAD_SHA;
  const runUrl = env.RUN_URL;
  const previous = readPreviousReview(contextDir);
  const run = readRun(contextDir);
  if (env.CODEX_RESULT !== 'success') {
    return renderUnavailable({
      reason: `The review job ended with status ${env.CODEX_RESULT}`,
      headSha,
      runUrl,
      previous,
      run,
      updatedAt: now
    });
  }
  const reviewJson =
    env.REVIEW_JSON_FILE && fs.existsSync(env.REVIEW_JSON_FILE)
      ? fs.readFileSync(env.REVIEW_JSON_FILE, 'utf8')
      : env.REVIEW_JSON;
  const parsed = parseReviewOutput(reviewJson);
  if (parsed.error) {
    console.log(`::warning::Rejected the reviewer output: ${parsed.error}`);
    logData(
      `Reviewer output (first 4000 characters):\n${String(reviewJson ?? '').slice(0, 4000)}`
    );
    return renderUnavailable({
      reason: `The reviewer output was rejected: ${parsed.error}`,
      headSha,
      runUrl,
      previous,
      run,
      updatedAt: now
    });
  }
  const prFiles = fs
    .readFileSync(path.join(contextDir, 'pr-files.txt'), 'utf8')
    .split('\n')
    .filter(Boolean);
  // With no reply to point to, a dismissal is only the reviewer changing its mind.
  const review =
    countReplies(contextDir) > 0
      ? parsed.review
      : {
          ...parsed.review,
          resolved: parsed.review.resolved.map((entry) =>
            entry.status === 'dismissed'
              ? { ...entry, status: 'withdrawn' }
              : entry
          )
        };
  const budget = applyBudget(review, prFiles, previous, {
    replyOnly: run.trigger === 'reply'
  });
  for (const finding of budget.outOfScope) {
    logData(
      `Dropped a finding outside the PR's files: ${finding.file}: ${finding.title}`
    );
  }
  return renderComment({
    review,
    budget,
    run,
    headSha,
    baseSha: env.BASE_SHA
  });
};

/**
 * Hands the comment body to the publishing job as the `comment` step output,
 * under a random delimiter that no model text can close early.
 * @param {string} outputPath - The $GITHUB_OUTPUT file.
 * @param {string} body - Comment body.
 */
const writeCommentOutput = (outputPath, body) => {
  const delimiter = `COMMENT_${crypto.randomBytes(16).toString('hex')}`;
  fs.appendFileSync(
    outputPath,
    `comment<<${delimiter}\n${body}\n${delimiter}\n`
  );
};

module.exports = {
  COMMENT_HEADING,
  COMMENT_MARKER,
  MAX_FINDINGS,
  applyBudget,
  buildCommentBody,
  parseReviewOutput,
  renderComment,
  statusFor,
  writeCommentOutput
};

if (require.main === module) {
  const [flag, contextDir] = process.argv.slice(2);
  if (flag !== '--context-dir' || !contextDir) {
    throw new Error('Usage: render.cjs --context-dir <dir>');
  }
  for (const name of [
    'CODEX_RESULT',
    'HEAD_SHA',
    'BASE_SHA',
    'REVIEW_MODEL',
    'RUN_URL',
    'REPO_URL'
  ]) {
    if (!process.env[name]) {
      throw new Error(`${name} is required`);
    }
  }
  const body = buildCommentBody({ env: process.env, contextDir });
  if (process.env.COMMENT_FILE) {
    fs.writeFileSync(process.env.COMMENT_FILE, body);
  }
  if (process.env.GITHUB_OUTPUT) {
    writeCommentOutput(process.env.GITHUB_OUTPUT, body);
  } else {
    process.stdout.write(`${body}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, body);
  }
}
