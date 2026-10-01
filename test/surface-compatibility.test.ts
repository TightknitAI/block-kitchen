import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { describe, expect, it } from 'vitest';
import { defaultPalette } from '../src/lib/default-blocks';
import { toValidatorSurface } from '../src/lib/error-grouping';
import { toSlackBlocks } from '../src/lib/to-slack-blocks';
import type { PreviewSurface, SupportedBlock } from '../src/types';

/**
 * Slack lists `container` and `data_visualization` as valid on Messages and
 * Home tabs; validator 0.1.17 stopped rejecting them on `home`
 * (TightknitAI/slack-block-kit-validator#107). These run the builder's own
 * palette defaults through the same pipeline as the live validation hook, so
 * dropping one onto App Home no longer counts as an error and disables Send.
 */
const variants = defaultPalette
  .flatMap((section) => section.variants)
  .filter((variant) => {
    const type = variant.factory().type;
    return type === 'container' || type === 'data_visualization';
  });

const cases = variants.map((variant) => [variant.id, variant] as const);

function validate(block: SupportedBlock, surface: PreviewSurface) {
  return validateBlockKit(toSlackBlocks([block]), { target: 'blocks', surface: toValidatorSurface(surface) });
}

describe('container / data_visualization surface compatibility', () => {
  it('covers both block types from the default palette', () => {
    const types = new Set(variants.map((variant) => variant.factory().type));
    expect(types).toEqual(new Set(['container', 'data_visualization']));
  });

  it.each(cases)('%s is valid on App Home', (_id, variant) => {
    expect(validate(variant.factory(), 'app_home').errors).toEqual([]);
  });

  it.each(cases)('%s is still rejected on modals', (_id, variant) => {
    expect(validate(variant.factory(), 'modal').valid).toBe(false);
  });
});
