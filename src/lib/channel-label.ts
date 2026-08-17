/**
 * How a channel reads everywhere the package names one — the picker, the
 * edit badge, the update dialog, the load preview. The space after the `#` is
 * deliberate: it keeps the hash a marker rather than the first character of
 * the name, so `# release-notes` stays legible at badge sizes.
 * @param name - the bare channel name, without a leading `#`
 * @returns the display label
 */
export function channelLabel(name: string): string {
  return `# ${name}`;
}
