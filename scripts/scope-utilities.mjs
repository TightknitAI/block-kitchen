/**
 * Post-build step: scope the `bk-utilities` cascade layer to this package's
 * own roots so its ~1485 generic Tailwind utilities apply only to
 * `.bk-root` / `.bk-portal-content` (and their descendants), never to the
 * whole host document.
 *
 * Runs after `tailwindcss --minify` (see the `build:css` script). We parse the
 * compiled stylesheet, find the single `@layer bk-utilities { … }` block,
 * anchor every selector inside it, then wrap the result in `@scope`:
 *
 *   @layer bk-utilities {
 *     @scope (.bk-root, .bk-portal-content) {
 *       :where(:scope,:scope *).flex { display: flex }
 *     }
 *   }
 *
 * The anchor is load-bearing, and its absence was a shipped bug. A bare
 * `.flex` inside `@scope` is implicitly `:scope .flex` — a *descendant*
 * selector — so a scoped style rule never matches its own scoping root. Both
 * roots carry utilities of their own (the builder shell's `flex h-full …`, a
 * dialog's `max-h-[85svh] flex-col …`), and every one of them was inert in a
 * consuming app: emitted into the stylesheet, but with nothing it could
 * match. Prefixing each selector's leading compound with
 * `:where(:scope,:scope *)` widens it to "the scoping root itself, or
 * anything inside it"; `:where()` adds no specificity, so rules keep the
 * weight — and therefore the intra-layer ordering — they had before.
 *
 * `bk-theme` (CSS custom properties) and Tailwind's `properties` layer stay
 * global; vars don't collide.
 *
 * We parse structure (not regex) so the already-minified input stays safe;
 * postcss preserves each rule's minified raws, so no re-minify step is needed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import postcss from "postcss";

/** Scoping roots: the builder shell, and every Radix portal we render into. */
const SCOPE_ROOTS = "(.bk-root, .bk-portal-content)";

/**
 * Compound prefix that widens a scoped selector from "descendant of the
 * scoping root" to "the scoping root, or a descendant of it".
 */
const ANCHOR = ":where(:scope,:scope *)";

/** Functional pseudo-classes Tailwind wraps whole selectors in. */
const WRAPPERS = [":is(", ":where("];

/** Characters a utility selector's leading compound may start with. */
const COMPOUND_STARTS = ".#[:";

/** Combinators that make a selector complex (descendant, child, siblings). */
const COMBINATORS = " >+~";

/**
 * Walk `selector`, yielding `[index, char, depth]` for every character that is
 * neither escaped nor inside a quoted string. `depth` is the bracket nesting
 * level *around* the character, so a group's opening and closing brackets both
 * report the same depth.
 * @param {string} selector - the selector to walk
 * @yields {[number, string, number]} index, character, and nesting depth
 */
function* scan(selector) {
	let depth = 0;
	for (let i = 0; i < selector.length; i++) {
		const ch = selector[i];
		// Tailwind escapes `[`, `]`, `:`, `/`, `.` and friends in class names.
		if (ch === "\\") {
			i++;
			continue;
		}
		if (ch === '"' || ch === "'") {
			i++;
			while (i < selector.length && selector[i] !== ch) {
				i += selector[i] === "\\" ? 2 : 1;
			}
			continue;
		}
		if (ch === "(" || ch === "[") {
			yield [i, ch, depth];
			depth++;
		} else if (ch === ")" || ch === "]") {
			depth--;
			yield [i, ch, depth];
		} else {
			yield [i, ch, depth];
		}
	}
}

/**
 * Index of the `)` closing the group that opens at `openIndex`, or `-1`.
 * @param {string} selector - the selector to search
 * @param {number} openIndex - index of the opening `(`
 * @returns {number} index of the matching `)`, or -1 when unbalanced
 */
function closingParen(selector, openIndex) {
	for (const [i, ch, depth] of scan(selector)) {
		if (i > openIndex && ch === ")" && depth === 0) return i;
	}
	return -1;
}

/**
 * Whether any of `chars` appears in `selector` at bracket depth 0.
 * @param {string} selector - the selector to search
 * @param {string} chars - characters to look for
 * @returns {boolean} true when one of them appears outside any group
 */
function hasTopLevel(selector, chars) {
	for (const [, ch, depth] of scan(selector)) {
		if (depth === 0 && chars.includes(ch)) return true;
	}
	return false;
}

/**
 * Where {@link ANCHOR} has to be spliced into `selector`: the start of its
 * leading compound — the one the implicit `:scope ` descendant prefix would
 * otherwise sit in front of.
 *
 * Tailwind emits two shapes that matter here. Most selectors are led by a
 * class (`.flex`, `.\[\&_svg\]\:size-4 svg`) and take the anchor at index 0.
 * Space utilities wrap the whole selector in `:where()` and make a *child* the
 * subject (`:where(.space-y-1\.5>:not(:last-child))`); those have to be
 * anchored inside the wrapper, since anchoring outside it would ask for the
 * scoping root to be the `:not(:last-child)` child rather than the element
 * carrying `space-y-1.5`.
 * @param {string} selector - a single (comma-free) selector
 * @returns {number} index at which to insert the anchor
 */
function anchorOffset(selector) {
	for (const wrapper of WRAPPERS) {
		if (!selector.startsWith(wrapper)) continue;
		// Only descend when the wrapper spans the whole selector and holds one
		// complex selector: with a top-level comma there is no single leading
		// compound to anchor, and with no combinator the wrapper *is* the
		// subject compound, so the anchor belongs in front of it.
		if (closingParen(selector, wrapper.length - 1) !== selector.length - 1) break;
		const inner = selector.slice(wrapper.length, -1);
		if (hasTopLevel(inner, ",") || !hasTopLevel(inner, COMBINATORS)) break;
		return wrapper.length + anchorOffset(inner);
	}

	if (!selector || !COMPOUND_STARTS.includes(selector[0])) {
		throw new Error(
			`scope-utilities: cannot anchor selector ${JSON.stringify(selector)}`,
		);
	}
	return 0;
}

/**
 * Widen one selector so it matches the scoping root as well as its subtree.
 * @param {string} selector - a single (comma-free) selector
 * @returns {string} the anchored selector
 */
export function anchorSelector(selector) {
	const trimmed = selector.trim();
	const at = anchorOffset(trimmed);
	return `${trimmed.slice(0, at)}${ANCHOR}${trimmed.slice(at)}`;
}

/**
 * Anchor the `bk-utilities` layer's rules and wrap them in an `@scope`
 * at-rule. Pure string -> string; throws unless exactly one utilities-layer
 * body is found (guards against a future Tailwind change to how the layer is
 * emitted).
 * @param {string} css - the compiled stylesheet
 * @returns {string} the stylesheet with its utilities layer scoped
 */
export function scopeUtilities(css) {
	const root = postcss.parse(css);

	let wrapped = 0;
	root.walkAtRules("layer", (layer) => {
		// Skip the `@layer bk-theme, bk-utilities;` ordering statement (no body).
		if (layer.params.trim() !== "bk-utilities" || !layer.nodes?.length) return;

		layer.walkRules((rule) => {
			// `@keyframes` children are offsets (`from`, `50%`), not element
			// selectors. Tailwind emits no keyframes into this layer today; the
			// guard keeps a future one from being mangled.
			const parent = rule.parent;
			if (parent?.type === "atrule" && parent.name.endsWith("keyframes")) return;
			rule.selectors = rule.selectors.map(anchorSelector);
		});

		const scope = postcss.atRule({
			name: "scope",
			params: SCOPE_ROOTS,
			nodes: [],
		});
		layer.each((child) => scope.append(child.clone()));
		layer.removeAll();
		layer.append(scope);
		wrapped++;
	});

	if (wrapped !== 1) {
		throw new Error(
			`scope-utilities: expected exactly 1 bk-utilities layer with a body, wrapped ${wrapped}`,
		);
	}

	return root.toString();
}

// CLI entry: only run when invoked directly, not when imported by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const target = process.argv[2] ?? "./dist/styles.css";
	writeFileSync(target, scopeUtilities(readFileSync(target, "utf8")));
}
