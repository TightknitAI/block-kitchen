import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { useEffect, useRef, useState } from 'react';
import { type GroupedErrors, groupValidatorErrors, toValidatorSurface } from '../lib/error-grouping';
import { toSlackBlocks } from '../lib/to-slack-blocks';
import { stripCustomEmojiForValidation } from '../lib/validation-sanitize';
import type { BuilderBlock, PreviewSurface } from '../types';

/**
 * Debounce delay between the latest edit and the next validation pass.
 * Short enough to feel live; long enough to avoid running the AJV
 * compiled validator on every keystroke.
 */
const DEBOUNCE_MS = 150;

/**
 * Result returned by {@link useBlockKitValidation}.
 */
export interface ValidationState extends GroupedErrors {
  /** True iff there are zero errors after the most recent run. */
  valid: boolean;
}

/**
 * Validates a block draft against {@link validateBlockKit}, scoped to the
 * given preview surface. Pure; safe to call during render.
 */
function computeValidation(blocks: BuilderBlock[], surface: PreviewSurface): ValidationState {
  // Rewrite custom / unknown emoji names to a known-valid placeholder in the
  // validation copy only, so they don't inflate `total` → disable Send. The
  // real payload (preview / JSON / Send) keeps the true names.
  const payload = stripCustomEmojiForValidation(toSlackBlocks(blocks.map((b) => b.block)));
  const result = validateBlockKit(payload, {
    target: 'blocks',
    surface: toValidatorSurface(surface)
  });
  const grouped = groupValidatorErrors(result.errors, blocks);
  return {
    valid: result.valid,
    byBlockId: grouped.byBlockId,
    general: grouped.general,
    total: grouped.total
  };
}

/**
 * Continuously validates the working draft against
 * {@link validateBlockKit}, scoped to the current preview surface.
 *
 * The first pass runs synchronously during initial render so consumers
 * never see a stale `errorCount: 0` for an invalid `initialBlocks`.
 * Subsequent passes are debounced so rapid edits don't thrash the AJV
 * compiled validator.
 *
 * @param blocks - current builder blocks (id + payload)
 * @param surface - the preview surface (drives surface-compatibility checks)
 * @returns the current validation state, grouped by block id
 */
export function useBlockKitValidation(blocks: BuilderBlock[], surface: PreviewSurface): ValidationState {
  const [state, setState] = useState<ValidationState>(() => computeValidation(blocks, surface));
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      return;
    }
    const handle = setTimeout(() => {
      setState(computeValidation(blocks, surface));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [blocks, surface]);

  return state;
}
