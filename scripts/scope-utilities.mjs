/**
 * Post-build step: scope the `bk-utilities` cascade layer to this package's
 * own roots so its ~1485 generic Tailwind utilities apply only under
 * `.bk-root` / `.bk-portal-content` (and their descendants), never to the
 * whole host document.
 *
 * Runs after `tailwindcss --minify` (see the `build:css` script). We parse the
 * compiled stylesheet, find the single `@layer bk-utilities { … }` block, and
 * wrap its rules in `@scope (.bk-root, .bk-portal-content) { … }`:
 *
 *   @layer bk-utilities {
 *     @scope (.bk-root, .bk-portal-content) { …utilities… }
 *   }
 *
 * `@scope` bare selectors match the scope root *and* its subtree, so
 * `.bk-root`'s own utilities (`flex h-full …`) still resolve — a plain
 * descendant-combinator wrap would miss the root elements. `bk-theme` (CSS
 * custom properties) and Tailwind's `properties` layer stay global; vars don't
 * collide.
 *
 * We parse structure (not regex) so the already-minified input stays safe;
 * postcss preserves each rule's minified raws, so no re-minify step is needed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import postcss from "postcss";

/**
 * Wrap the `bk-utilities` layer's rules in an `@scope` at-rule. Pure string ->
 * string; throws unless exactly one utilities-layer body is found (guards
 * against a future Tailwind change to how the layer is emitted).
 */
export function scopeUtilities(css) {
	const root = postcss.parse(css);

	let wrapped = 0;
	root.walkAtRules("layer", (layer) => {
		// Skip the `@layer bk-theme, bk-utilities;` ordering statement (no body).
		if (layer.params.trim() !== "bk-utilities" || !layer.nodes?.length) return;

		const scope = postcss.atRule({
			name: "scope",
			params: "(.bk-root, .bk-portal-content)",
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
