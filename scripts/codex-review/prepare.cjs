/**
 * Builds the evidence the automated PR reviewer reads: the reviewable changed
 * files, their diff against the base branch, the rule docs that apply to them,
 * the pull request's metadata, what people wrote on it, and the findings the
 * last review left open. Then decides whether this run reviews: a push whose
 * diff the last review already covers reuses it, and a comment reviews only
 * when it asks for one or replies to an open finding. Run from the checked-out
 * PR head; writes `review_needed`, `nothing_to_review`, `trigger` and `reason`
 * to $GITHUB_OUTPUT and the rule list to $GITHUB_STEP_SUMMARY.
 *
 * Usage: node scripts/codex-review/prepare.cjs --base <git-ref> --pr-json <file> --out <dir>
 * Environment: PR_COMMENTS_JSON and PR_REVIEW_COMMENTS_JSON (the PR's comments as the GitHub API returns them),
 * REVIEW_MODEL, EVENT_NAME, RUN_ATTEMPT, and on a comment event TRIGGER_COMMENT_ID.
 */

const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { buildRuleManifest, matchesAny } = require('./rules.cjs');
const {
  findCoverage,
  findPreviousReview,
  latestReviewComment
} = require('./state.cjs');

/** Generated, vendored, and binary files that carry no reviewable change. */
const IGNORED_GLOBS = [
  '**/pnpm-lock.yaml',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/bun.lockb',
  '**/worker-configuration.d.ts',
  '**/*.generated.*',
  '**/*.gen.*',
  '**/__snapshots__/**',
  '**/*.snap',
  '**/*.{png,jpg,jpeg,gif,webp,avif,ico,mp3,mp4,pdf}',
  '**/*.{woff,woff2,ttf,otf,eot}',
  '**/CHANGELOG.md',
  '**/{fixtures,__fixtures__}/**/*.json',
  '**/*.fixture.json'
];

/** What the reviewer reads besides the diff and the rule docs. AGENTS.md is loaded automatically. */
const REVIEWER_FILES = [
  'AGENTS.md',
  '.github/codex-review/prompt.md',
  '.github/codex-review/review-output.schema.json'
];
/** A comment with this command asks for a full review. */
const REVIEW_COMMAND = /(?:^|\s)\/lontra-review(?=\s|$)/;
const FINDING_MENTION = /\bF([1-9]\d*)\b/gi;
const INLINE_FINDING_MARKER = /^<!-- codex-review-finding:(F[1-9]\d*) -->/;
const MAX_REPLIES = 50;
const MAX_REPLY_LENGTH = 5000;
/** The run a library caller gets unless it says otherwise: a review requested by hand. */
const MANUAL_REQUEST = Object.freeze({
  event: 'workflow_dispatch',
  attempt: 1,
  commentId: null
});

/**
 * Drops generated, vendored, and binary files from a changed-file list.
 * @param {string[]} files - Repo-relative changed files.
 * @returns {string[]} The files worth reviewing, in their original order.
 */
const reviewableFiles = (files) =>
  files.filter((file) => !matchesAny(file, IGNORED_GLOBS));

/**
 * Runs git in the repository and returns its stdout. Pathspecs are literal, so
 * a changed file named like pathspec magic (`:(exclude)**`) can't empty the diff.
 * @param {string} rootDir - Repository root.
 * @param {string[]} args - Git arguments.
 * @returns {string} Command output.
 */
const git = (rootDir, args) =>
  execFileSync(
    'git',
    ['--literal-pathspecs', '-c', 'core.quotePath=false', ...args],
    {
      cwd: rootDir,
      encoding: 'utf8',
      maxBuffer: 512 * 1024 * 1024
    }
  );

/**
 * Describes the last review for the reviewer's context file.
 * @param {ReturnType<typeof findPreviousReview>} previousReview - The last review's state.
 * @returns {string} One line.
 */
const describePreviousReview = (previousReview) => {
  if (previousReview.head_sha === null) {
    return 'none';
  }
  const open = previousReview.findings.length;
  return `${previousReview.head_sha}, ${open} open ${open === 1 ? 'finding' : 'findings'} (previous-review.json)`;
};

/**
 * Lists the open findings a comment names, such as `F2`.
 * @param {string} body - The comment body.
 * @param {{ id: string }[]} findings - The open findings.
 * @returns {string[]} Their IDs, in the order the findings are listed.
 */
const mentionedFindings = (body, findings) => {
  const named = new Set(
    [...body.matchAll(FINDING_MENTION)].map((match) => `F${match[1]}`)
  );
  return findings.map((finding) => finding.id).filter((id) => named.has(id));
};

/**
 * Finds the newest comment on the PR. Comment IDs only grow, so every comment
 * with an ID up to this one was there when the evidence was gathered.
 * @param {object[]} comments - The PR's issue comments.
 * @returns {number | null} The highest comment ID, or null when there are no comments.
 */
const latestCommentId = (comments) => {
  const ids = comments
    .map((comment) => comment?.id)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  return ids.length > 0 ? Math.max(...ids) : null;
};

/**
 * Adds human replies from Lontra inline threads to the PR conversation evidence.
 * @param {object[]} issueComments - Conversation comments on the PR.
 * @param {object[]} reviewComments - Inline review comments and their replies.
 * @returns {object[]} Comments the reviewer can act on, ordered by ID.
 */
const mergeReviewComments = (issueComments, reviewComments) => {
  const findingByRootId = new Map();
  for (const comment of reviewComments) {
    const findingId = comment?.body?.match(INLINE_FINDING_MARKER)?.[1];
    if (Number.isSafeInteger(comment?.id) && findingId) {
      findingByRootId.set(comment.id, findingId);
    }
  }
  const inlineReplies = reviewComments
    .filter(
      (comment) =>
        comment?.user?.type === 'User' &&
        Number.isSafeInteger(comment.in_reply_to_id) &&
        findingByRootId.has(comment.in_reply_to_id)
    )
    .map((comment) => ({
      ...comment,
      body: `${findingByRootId.get(comment.in_reply_to_id)} (inline reply): ${comment.body ?? ''}`
    }));
  return [...issueComments, ...inlineReplies].sort((a, b) => a.id - b.id);
};

/**
 * Picks the comments people wrote that the reviewer reads, at most MAX_REPLIES:
 * first the unread ones that name an open finding or ask for a review, oldest
 * first, since only those can start a review, then the latest of the rest.
 * @param {object[]} comments - The PR's issue comments, oldest first, as the GitHub API returns them.
 * @param {number} alreadyRead - The newest comment the last review read; 0 when it read none.
 * @param {{ id: string }[]} findings - The findings the last review left open.
 * @returns {{ replies: { id: number, author: string, created_at: string, body: string }[], readThrough: number | null }}
 *   The replies, oldest first, each body cut to MAX_REPLY_LENGTH, and the newest comment the review has read
 *   once it reads them: just before the first comment that asks for a review and didn't fit, or the newest on the PR.
 */
const readReplies = (comments, alreadyRead, findings) => {
  const people = comments.filter(
    (comment) =>
      comment?.user?.type === 'User' &&
      Number.isSafeInteger(comment.id) &&
      typeof comment.body === 'string'
  );
  const asks = (comment) =>
    comment.id > alreadyRead &&
    (REVIEW_COMMAND.test(comment.body) ||
      mentionedFindings(comment.body, findings).length > 0);
  const asking = people.filter(asks);
  const others = people.filter((comment) => !asks(comment));
  const kept = new Set(asking.slice(0, MAX_REPLIES));
  for (const comment of others.slice(
    Math.max(0, others.length - (MAX_REPLIES - kept.size))
  )) {
    kept.add(comment);
  }
  const leftOut = asking.find((comment) => !kept.has(comment));
  return {
    replies: people
      .filter((comment) => kept.has(comment))
      .map((comment) => ({
        id: comment.id,
        author: comment.user.login,
        created_at: comment.created_at,
        body:
          comment.body.length > MAX_REPLY_LENGTH
            ? `${comment.body.slice(0, MAX_REPLY_LENGTH)}…`
            : comment.body
      })),
    readThrough: leftOut ? leftOut.id - 1 : latestCommentId(comments)
  };
};

/**
 * Fingerprints everything the reviewer is given: the model, the PR's title and
 * description, the diff, the reviewer's own instructions, and the rule docs. A
 * rebase or a base-branch merge that touches none of the PR's files leaves the
 * diff, and so the fingerprint, unchanged.
 * @param {{ rootDir: string, prMd: string, diff: string, manifest: { rules: { path: string }[] }, model: string | null }} args
 *   Repository root, the PR's title and description, the PR diff, the applicable rule docs, and the review model.
 * @returns {string} A SHA-256 hex digest.
 */
const fingerprintReview = ({ rootDir, prMd, diff, manifest, model }) => {
  const read = (file) => {
    const absolute = path.join(rootDir, file);
    return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
  };
  const inputs = [
    ['model', model],
    ['pr.md', prMd],
    ['diff', diff],
    ...[...REVIEWER_FILES, ...manifest.rules.map((rule) => rule.path)].map(
      (file) => [file, read(file)]
    )
  ];
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(inputs))
    .digest('hex');
};

/**
 * Finds how far the PR's comments have been read: up to the coverage of the
 * latest review comment, none when there is no review comment yet, and unknown
 * when the latest one records nothing, as a retired review doesn't.
 * @param {ReturnType<typeof findCoverage>} coverage - What the latest review comment covers.
 * @param {object[]} comments - The PR's issue comments.
 * @returns {number | null} The newest comment read, 0 for none, or null when unknown.
 */
const readThroughOf = (coverage, comments) => {
  if (coverage) {
    return coverage.replies_through ?? 0;
  }
  return latestReviewComment(comments) ? null : 0;
};

/**
 * Decides whether this run reviews the pull request, and why. A comment counts
 * when the last review hasn't read it, so a run that replaced or cancelled a
 * comment run still answers that comment, even a push that otherwise reuses the review.
 * @param {{ request: typeof MANUAL_REQUEST, files: string[], fingerprint: string, previousReview: ReturnType<typeof findPreviousReview>, coverage: ReturnType<typeof findCoverage>, comments: object[] }} args
 *   The event that started the run, the reviewable files, the review fingerprint, the last review's state,
 *   what the latest review comment covers (no fingerprint when it is an unavailable notice), and the PR's issue comments.
 * @returns {{ trigger: 'push' | 'manual' | 'command' | 'reply', review: boolean, retire: boolean, reason: string, comment: object | null, mentioned: string[] }}
 *   Whether to review or retire the last review, why in one line, and the comment that asked, with the open findings it names.
 */
const decideReview = ({
  request,
  files,
  fingerprint,
  previousReview,
  coverage,
  comments
}) => {
  const outcome = (
    trigger,
    review,
    reason,
    comment = null,
    mentioned = []
  ) => ({
    trigger,
    review,
    retire: false,
    reason,
    comment,
    mentioned
  });
  const fromPerson = (entry) =>
    entry?.user?.type === 'User' &&
    Number.isSafeInteger(entry.id) &&
    typeof entry.body === 'string';
  const covered = coverage?.fingerprint ? coverage : null;
  const readThrough = readThroughOf(coverage, comments);
  const unreadSinceCoverage = () =>
    comments.filter((entry) => fromPerson(entry) && entry.id > readThrough);
  const askedForReview = (unread) => {
    const command = unread.findLast((entry) => REVIEW_COMMAND.test(entry.body));
    return command
      ? outcome(
          'command',
          true,
          `${command.user.login} asked for a review.`,
          command
        )
      : null;
  };
  const repliedToFindings = (unread) => {
    const replies = unread.filter(
      (entry) =>
        mentionedFindings(entry.body, previousReview.findings).length > 0
    );
    if (replies.length === 0) {
      return null;
    }
    const mentioned = mentionedFindings(
      replies.map((entry) => entry.body).join('\n'),
      previousReview.findings
    );
    const authors = [...new Set(replies.map((entry) => entry.user.login))];
    return outcome(
      'reply',
      true,
      `${authors.join(', ')} replied about ${mentioned.join(', ')}.`,
      replies.at(-1),
      mentioned
    );
  };
  const isComment = ['issue_comment', 'pull_request_review_comment'].includes(
    request.event
  );

  if (files.length === 0) {
    return isComment
      ? outcome('reply', false, 'Nothing reviewable changed.')
      : {
          ...outcome('push', false, 'Only generated or binary files changed.'),
          retire: true
        };
  }
  if (request.attempt > 1) {
    return outcome('manual', true, 'The workflow was re-run.');
  }
  if (request.event === 'workflow_dispatch') {
    return outcome('manual', true, 'Requested from the Actions tab.');
  }
  if (!isComment) {
    if (covered?.fingerprint !== fingerprint) {
      return outcome(
        'push',
        true,
        covered
          ? 'The description, the diff, the rule docs or the reviewer changed since the last review.'
          : 'No complete review covers this pull request yet.'
      );
    }
    const unread = unreadSinceCoverage();
    return (
      askedForReview(unread) ??
      repliedToFindings(unread) ??
      outcome(
        'push',
        false,
        `The description, the diff, the rule docs and the reviewer are unchanged since the review of \`${previousReview.head_sha?.slice(0, 8)}\`, so that review still applies.`
      )
    );
  }

  // A review comment that records no coverage (written before it existed) was last written after its run read the
  // comments, so what came after that update is unread, as is the comment that started this run.
  const latestReview = latestReviewComment(comments);
  const unread =
    readThrough !== null
      ? unreadSinceCoverage()
      : comments.filter(
          (entry) =>
            fromPerson(entry) &&
            (entry.id === request.commentId ||
              (typeof entry.created_at === 'string' &&
                typeof latestReview?.updated_at === 'string' &&
                entry.created_at > latestReview.updated_at))
        );
  if (unread.length === 0) {
    return outcome(
      'reply',
      false,
      coverage
        ? 'The last review already read every comment.'
        : 'The comment that started this run is gone, or is not from a person.'
    );
  }
  const asked = askedForReview(unread);
  if (asked) {
    return asked;
  }
  if (!covered) {
    return outcome(
      'reply',
      false,
      'There is no complete review to update, so the comment waits for the next review.'
    );
  }
  if (covered.fingerprint !== fingerprint) {
    return outcome(
      'reply',
      false,
      'The code changed since the last review, so the comment waits for the next review.'
    );
  }
  return (
    repliedToFindings(unread) ??
    outcome('reply', false, 'No new comment names an open finding.')
  );
};

/**
 * Describes what started the review for the reviewer's context file.
 * @param {ReturnType<typeof decideReview>} decision - The decision.
 * @returns {string} One line.
 */
const describeRequest = (decision) => {
  if (!decision.review) {
    return `nothing, since this run does not review: ${decision.reason}`;
  }
  switch (decision.trigger) {
    case 'command':
      return `${decision.comment.user.login} in comment ${decision.comment.id} (replies.json), asking for a full review`;
    case 'reply':
      return `replies in replies.json about ${decision.mentioned.join(', ')}, the latest in comment ${decision.comment.id}. The code is unchanged since the earlier review`;
    case 'manual':
      return 'a manual run';
    default:
      return 'a push to the pull request';
  }
};

/**
 * Collects the review evidence for the checked-out pull request head and decides whether to review.
 * @param {{ rootDir: string, base: string, pr: object, comments?: object[], model?: string | null, request?: typeof MANUAL_REQUEST }} args
 *   Repository root, base ref to diff against, the PR and its issue comments as returned by the GitHub API,
 *   the review model, and the event that started the run.
 * @returns {{ files: string[], ignoredCount: number, diff: string, manifest: ReturnType<typeof buildRuleManifest>, contextMd: string, prMd: string, previousReview: ReturnType<typeof findPreviousReview>, replies: ReturnType<typeof readReplies>['replies'], run: { trigger: string, fingerprint: string, replies_through: number | null }, decision: ReturnType<typeof decideReview> }}
 *   Everything the reviewer reads, and the decision; `files` is empty when nothing reviewable changed.
 */
const buildEvidence = ({
  rootDir,
  base,
  pr,
  comments = [],
  model = null,
  request = MANUAL_REQUEST
}) => {
  const previousReview = findPreviousReview(comments);
  const changed = git(rootDir, [
    'diff',
    '--name-only',
    '-z',
    '--no-renames',
    `${base}...HEAD`
  ])
    .split('\0')
    .filter(Boolean);
  const files = reviewableFiles(changed);
  const diff =
    files.length > 0
      ? git(rootDir, [
          'diff',
          '--no-color',
          '--no-ext-diff',
          `${base}...HEAD`,
          '--',
          ...files
        ])
      : '';
  const manifest = buildRuleManifest({ rootDir, files });
  const prMd = `# ${pr.title}\n\n${pr.body ?? '(no description)'}\n`;
  const coverage = findCoverage(comments);
  const { replies, readThrough } = readReplies(
    comments,
    readThroughOf(coverage, comments) ?? 0,
    previousReview.findings
  );
  const fingerprint = fingerprintReview({
    rootDir,
    prMd,
    diff,
    manifest,
    model
  });
  const decision = decideReview({
    request,
    files,
    fingerprint,
    previousReview,
    coverage,
    comments
  });

  const contextMd = [
    `Repository: ${pr.base.repo.full_name}`,
    `Pull request: #${pr.number}`,
    `Author: ${pr.user.login}`,
    `Base branch: ${pr.base.ref}`,
    `Head SHA: ${pr.head.sha}`,
    `Diff: merge base of ${base} and the head (the same diff GitHub shows)`,
    `Reviewable files: ${files.length} (${changed.length - files.length} generated or binary files skipped)`,
    `Rule docs to read: ${manifest.rules.length} (${Math.round(manifest.totalBytes / 1024)} KB)`,
    `Earlier review: ${describePreviousReview(previousReview)}`,
    `Replies: ${replies.length} ${replies.length === 1 ? 'comment' : 'comments'} from people (replies.json)`,
    `Requested by: ${describeRequest(decision)}`,
    ''
  ].join('\n');

  return {
    files,
    ignoredCount: changed.length - files.length,
    diff,
    manifest,
    contextMd,
    prMd,
    previousReview,
    replies,
    run: {
      trigger: decision.trigger,
      fingerprint,
      replies_through: readThrough
    },
    decision
  };
};

/**
 * Writes the evidence files the reviewer reads.
 * @param {string} outDir - Output directory.
 * @param {ReturnType<typeof buildEvidence>} evidence - Evidence from buildEvidence.
 */
const writeEvidence = (outDir, evidence) => {
  fs.mkdirSync(outDir, { recursive: true });
  const write = (name, content) =>
    fs.writeFileSync(path.join(outDir, name), content);
  write('context.md', evidence.contextMd);
  write('pr.md', evidence.prMd);
  write('pr-files.txt', `${evidence.files.join('\n')}\n`);
  write('full.diff', evidence.diff);
  write(
    'applicable-rules.txt',
    `${evidence.manifest.rules.map((rule) => rule.path).join('\n')}\n`
  );
  write(
    'rule-manifest.json',
    `${JSON.stringify(evidence.manifest, null, 2)}\n`
  );
  write(
    'previous-review.json',
    `${JSON.stringify(evidence.previousReview, null, 2)}\n`
  );
  write('replies.json', `${JSON.stringify(evidence.replies, null, 2)}\n`);
  write('run.json', `${JSON.stringify(evidence.run, null, 2)}\n`);
};

/**
 * Renders the rule list for the job summary.
 * @param {ReturnType<typeof buildEvidence>} evidence - Evidence from buildEvidence.
 * @returns {string} Markdown summary.
 */
const renderSummary = (evidence) => {
  if (!evidence.decision.review) {
    return `### Codex review skipped\n\n${evidence.decision.reason}\n`;
  }
  const { manifest } = evidence;
  const rows = manifest.rules.map(
    (rule) => `| \`${rule.path}\` | ${rule.reason} | ${rule.bytes} |`
  );
  const unrouted =
    manifest.unrouted.length > 0
      ? `\nSkipped for lacking a valid \`paths:\` list: ${manifest.unrouted.map((rule) => `\`${rule}\``).join(', ')}\n`
      : '';
  return [
    '### Codex review evidence',
    '',
    evidence.decision.reason,
    '',
    `Earlier review: ${describePreviousReview(evidence.previousReview)}.`,
    '',
    `${evidence.files.length} reviewable files, ${evidence.ignoredCount} skipped. ${manifest.rules.length} rule docs (${manifest.totalBytes} bytes):`,
    '',
    '| Rule doc | Why | Bytes |',
    '|---|---|---|',
    ...rows,
    unrouted
  ].join('\n');
};

/**
 * Reads `--name value` pairs from the command line.
 * @param {string[]} argv - Arguments after the script path.
 * @returns {{ base: string, prJson: string, out: string }} Parsed options.
 */
const parseArgs = (argv) => {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.replace(/^--/, '');
    const value = argv[index + 1];
    if (!['base', 'pr-json', 'out'].includes(name) || !value) {
      throw new Error(`Unknown or incomplete argument: ${argv[index]}`);
    }
    options[name] = value;
  }
  if (!options.base || !options['pr-json'] || !options.out) {
    throw new Error(
      'Usage: prepare.cjs --base <git-ref> --pr-json <file> --out <dir>'
    );
  }
  return { base: options.base, prJson: options['pr-json'], out: options.out };
};

module.exports = {
  buildEvidence,
  decideReview,
  mergeReviewComments,
  reviewableFiles,
  writeEvidence
};

if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  for (const name of [
    'PR_COMMENTS_JSON',
    'REVIEW_MODEL',
    'EVENT_NAME',
    'RUN_ATTEMPT'
  ]) {
    if (!process.env[name]) {
      throw new Error(`${name} is required`);
    }
  }
  const commentEvent = [
    'issue_comment',
    'pull_request_review_comment'
  ].includes(process.env.EVENT_NAME);
  const request = {
    event: process.env.EVENT_NAME,
    attempt: Number(process.env.RUN_ATTEMPT),
    commentId: commentEvent ? Number(process.env.TRIGGER_COMMENT_ID) : null
  };
  if (commentEvent && !request.commentId) {
    throw new Error('TRIGGER_COMMENT_ID is required on a comment event');
  }
  const pr = JSON.parse(fs.readFileSync(options.prJson, 'utf8'));
  const issueComments = JSON.parse(
    fs.readFileSync(process.env.PR_COMMENTS_JSON, 'utf8')
  );
  const reviewComments = process.env.PR_REVIEW_COMMENTS_JSON
    ? JSON.parse(fs.readFileSync(process.env.PR_REVIEW_COMMENTS_JSON, 'utf8'))
    : [];
  const comments = mergeReviewComments(issueComments, reviewComments);
  const evidence = buildEvidence({
    rootDir: process.cwd(),
    base: options.base,
    pr,
    comments,
    model: process.env.REVIEW_MODEL,
    request
  });
  writeEvidence(options.out, evidence);
  const { decision } = evidence;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `review_needed=${decision.review}`,
        `nothing_to_review=${decision.retire}`,
        `trigger=${decision.trigger}`,
        `reason=${decision.reason}`,
        ''
      ].join('\n')
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderSummary(evidence));
  }
  console.log(
    decision.review
      ? `${evidence.files.length} files to review with ${evidence.manifest.rules.length} rule docs. ${decision.reason}`
      : `No review: ${decision.reason}`
  );
}
