import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs build script, no types
import { scopeUtilities } from '../scripts/scope-utilities.mjs';

// Mirrors the shape Tailwind emits: an ordering statement, a global theme
// layer, then the utilities layer we want scoped.
const INPUT = [
  '@layer bk-theme, bk-utilities;',
  '@layer bk-theme{:root{--color-primary:blue}}',
  '@layer bk-utilities{.flex{display:flex}.hidden{display:none}}'
].join('');

describe('scopeUtilities', () => {
  const out = scopeUtilities(INPUT);

  it("wraps the utilities layer body in an @scope rooted on the package's roots", () => {
    expect(out).toContain('@layer bk-utilities{@scope (.bk-root, .bk-portal-content){');
    // utilities are preserved verbatim inside the scope
    expect(out).toContain('.flex{display:flex}');
    expect(out).toContain('.hidden{display:none}');
  });

  it('leaves the ordering statement and the theme layer global', () => {
    expect(out).toContain('@layer bk-theme, bk-utilities;');
    // theme layer is untouched — not wrapped in @scope
    expect(out).toContain('@layer bk-theme{:root{--color-primary:blue}}');
    expect(out.match(/@scope/g)).toHaveLength(1);
  });

  it('throws if there is no bk-utilities layer body (guards Tailwind emission changes)', () => {
    expect(() => scopeUtilities('@layer bk-theme{:root{}}')).toThrow(/expected exactly 1 bk-utilities layer/);
  });
});
