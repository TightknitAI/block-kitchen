import type { SupportedBlock } from '../types';
import { sanitizeBlock } from './sanitize-blocks';

/**
 * Prepare blocks for the Slack API: scrub dangerous URI schemes from any
 * `url`/`image_url` fields and drop the read-only metadata Slack attaches
 * on retrieval but rejects on send. Every URL/image-url is routed through
 * the allowlist in `lib/url-safety.ts` so a payload that round-trips
 * through the builder cannot carry `javascript:`/`data:text/html` URIs to
 * a downstream consumer or to the Slack API.
 *
 * Header `level` is passed through: it is a real Slack field (an integer
 * 1-4, see https://docs.slack.dev/reference/block-kit/blocks/header-block),
 * not a builder-only extension. Earlier versions stripped it here, which
 * silently dropped the heading level from every sent message. Out-of-range
 * values are left intact so they surface as validation errors rather than
 * being quietly discarded.
 *
 * @param blocks - the working draft blocks
 * @returns blocks with retrieval-only fields removed and URLs scrubbed
 */
export function toSlackBlocks(blocks: SupportedBlock[]): SupportedBlock[] {
  return blocks.map((block) => sanitizeBlock(block));
}
