import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { describe, expect, it } from 'vitest';
import { defaultPalette } from '../src/lib/default-blocks';
import { toValidatorSurface } from '../src/lib/error-grouping';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import type { PreviewSurface, SupportedBlock } from '../src/types';

/**
 * Slack lists `container`, `data_visualization` and `data_table` as valid on
 * Messages and Home tabs; validator 0.1.17 stopped rejecting the first two
 * on `home` (TightknitAI/slack-block-kit-validator#107). These run the
 * builder's own palette defaults through the same pipeline as the live
 * validation hook, so dropping one onto App Home no longer counts as an
 * error and disables Send.
 */
const HOME_TAB_TYPES = new Set(['container', 'data_visualization', 'data_table']);

const variants = defaultPalette
  .flatMap((section) => section.variants)
  .filter((variant) => HOME_TAB_TYPES.has(variant.factory().type));

const cases = variants.map((variant) => [variant.id, variant] as const);

function validate(block: SupportedBlock, surface: PreviewSurface) {
  return validateBlockKit(toSlackBlocks([block]), { target: 'blocks', surface: toValidatorSurface(surface) });
}

describe('container / data_visualization / data_table surface compatibility', () => {
  it('covers every one of these block types from the default palette', () => {
    const types = new Set(variants.map((variant) => variant.factory().type));
    expect(types).toEqual(HOME_TAB_TYPES);
  });

  it.each(cases)('%s is valid on App Home', (_id, variant) => {
    expect(validate(variant.factory(), 'app_home').errors).toEqual([]);
  });

  it.each(cases)('%s is still rejected on modals', (_id, variant) => {
    expect(validate(variant.factory(), 'modal').valid).toBe(false);
  });
});
