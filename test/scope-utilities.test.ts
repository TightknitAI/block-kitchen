import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain .mjs build script, no types
import { anchorSelector, scopeUtilities } from '../scripts/scope-utilities.mjs';

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
    // declarations are preserved verbatim inside the scope
    expect(out).toContain('{display:flex}');
    expect(out).toContain('{display:none}');
  });

  it('anchors every scoped selector so it matches the scoping root too', () => {
    // A bare `.flex` inside `@scope` means `:scope .flex` — a descendant
    // selector, which never matches the scoping root itself. `.bk-root` and
    // `.bk-portal-content` both carry utilities of their own, so without the
    // anchor those are inert in a consuming app.
    expect(out).toContain(':where(:scope,:scope *).flex{display:flex}');
    expect(out).toContain(':where(:scope,:scope *).hidden{display:none}');
  });

  it('leaves the ordering statement and the theme layer global', () => {
    expect(out).toContain('@layer bk-theme, bk-utilities;');
    // theme layer is untouched — not wrapped in @scope, not anchored
    expect(out).toContain('@layer bk-theme{:root{--color-primary:blue}}');
    expect(out.match(/@scope/g)).toHaveLength(1);
  });

  it('anchors rules nested in @media and @supports', () => {
    const nested = scopeUtilities(
      '@layer bk-utilities{@media (min-width:64rem){.lg\\:flex{display:flex}}@supports (display:grid){.grid{display:grid}}}'
    );
    expect(nested).toContain(':where(:scope,:scope *).lg\\:flex{display:flex}');
    expect(nested).toContain(':where(:scope,:scope *).grid{display:grid}');
  });

  it('leaves @keyframes offsets alone', () => {
    const frames = scopeUtilities('@layer bk-utilities{@keyframes spin{from{rotate:0deg}to{rotate:360deg}}}');
    expect(frames).toContain('@keyframes spin{from{rotate:0deg}to{rotate:360deg}}');
  });

  it('throws if there is no bk-utilities layer body (guards Tailwind emission changes)', () => {
    expect(() => scopeUtilities('@layer bk-theme{:root{}}')).toThrow(/expected exactly 1 bk-utilities layer/);
  });
});

describe('anchorSelector', () => {
  it('anchors a leading class compound', () => {
    expect(anchorSelector('.max-h-\\[85svh\\]')).toBe(':where(:scope,:scope *).max-h-\\[85svh\\]');
  });

  it('anchors the leading compound of a complex selector, not its subject', () => {
    // The utility class sits on the ancestor; the `svg` it styles is the
    // subject. Anchoring the subject would demand the root *be* the svg.
    expect(anchorSelector('.\\[\\&_svg\\]\\:size-4 svg')).toBe(':where(:scope,:scope *).\\[\\&_svg\\]\\:size-4 svg');
  });

  it('anchors inside a wrapper that spans the whole selector', () => {
    // Tailwind's space utilities: `:where()` wraps everything and the subject
    // is a child, so the anchor belongs on the class inside the wrapper.
    expect(anchorSelector(':where(.space-y-1\\.5>:not(:last-child))')).toBe(
      ':where(:where(:scope,:scope *).space-y-1\\.5>:not(:last-child))'
    );
  });

  it('anchors in front of a wrapper that is itself the subject compound', () => {
    // No combinator inside, so the wrapper matches the element the utility is
    // on — the anchor goes outside it.
    expect(anchorSelector(':is(.a,.b)')).toBe(':where(:scope,:scope *):is(.a,.b)');
    expect(anchorSelector(':where(.a) .b')).toBe(':where(:scope,:scope *):where(.a) .b');
  });

  it('keeps a trailing pseudo-class or pseudo-element on the subject', () => {
    expect(anchorSelector('.hover\\:underline:hover')).toBe(':where(:scope,:scope *).hover\\:underline:hover');
    expect(anchorSelector('.placeholder\\:text-sm::placeholder')).toBe(
      ':where(:scope,:scope *).placeholder\\:text-sm::placeholder'
    );
  });

  it('is not fooled by combinators inside brackets or strings', () => {
    expect(anchorSelector('.data-\\[a\\>b\\]\\:block[data-x="y>z"]')).toBe(
      ':where(:scope,:scope *).data-\\[a\\>b\\]\\:block[data-x="y>z"]'
    );
  });

  it('throws rather than mangling a selector it cannot anchor', () => {
    // A leading type selector would need `div:where(…)`, not `:where(…)div`.
    expect(() => anchorSelector('div.foo')).toThrow(/cannot anchor selector/);
    expect(() => anchorSelector('> .child')).toThrow(/cannot anchor selector/);
  });
});
