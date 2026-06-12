import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCKS_INPUT_SHAPE_ERROR, unwrapBlocksInput } from '../lib/parse-blocks-input';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../lib/ui/sheet';
import type { SupportedBlock } from '../types';

/**
 * Upper bound on the JSON textarea we accept. A pasted multi-megabyte
 * payload would freeze the tab inside `JSON.parse` before the validator
 * gets a look; 1 MiB is well above any realistic Slack Block Kit message
 * (Slack itself caps blocks at 50 per message and ~3000 chars per text
 * field).
 */
const MAX_JSON_BYTES = 1024 * 1024;

/**
 * Side drawer that exposes the current draft as raw JSON in a full-height
 * code-editor-style textarea. Edits flow live: every valid parse updates
 * the preview immediately; parse and validation errors are shown inline
 * without stomping the in-progress text.
 *
 * A left-side gutter renders line numbers in sync with the textarea's
 * vertical scroll. The gutter's scrollTop tracks the textarea's so long
 * lists of blocks stay aligned.
 *
 * When the drawer opens, the textarea initializes from the current blocks.
 * While it's open, the textarea is the source of truth; external edits via
 * popover do not override mid-typed JSON.
 * @param props - drawer props
 * @param props.open - whether the drawer is open
 * @param props.onOpenChange - notified when the user closes the drawer
 * @param props.blocks - current draft blocks (used to seed the textarea on open)
 * @param props.onApply - called on every valid parse; updates the preview
 * @returns the rendered JSON drawer
 */
export function JsonDrawer({
  open,
  onOpenChange,
  blocks,
  onApply
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: SupportedBlock[];
  onApply: (blocks: SupportedBlock[]) => void;
}) {
  const [value, setValue] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  // Hold the latest blocks in a ref so the open-seed effect can read them
  // without listing them as a dependency. While the drawer is open the
  // textarea is the source of truth; external edits must not stomp typing.
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  });

  useEffect(() => {
    if (open) {
      setValue(JSON.stringify(blocksRef.current, null, 2));
      setParseError(null);
      setValidationErrors([]);
    }
  }, [open]);

  const handleChange = (next: string) => {
    setValue(next);
    if (next.length > MAX_JSON_BYTES) {
      setParseError(`JSON exceeds the ${Math.round(MAX_JSON_BYTES / 1024)} KiB editor limit.`);
      setValidationErrors([]);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(next);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid JSON');
      setValidationErrors([]);
      return;
    }
    // Accept either a bare blocks array or Slack's own message wrapper
    // (`{ "blocks": [...] }`, as exported by the Block Kit Builder). Other
    // top-level keys on the wrapper are ignored. Anything else keeps the
    // inline error without mutating state.
    const blocks = unwrapBlocksInput(parsed);
    if (!blocks) {
      setParseError(BLOCKS_INPUT_SHAPE_ERROR);
      setValidationErrors([]);
      return;
    }
    setParseError(null);
    onApply(blocks);
    const result = validateBlockKit(blocks, {
      target: 'blocks',
      surface: 'message'
    });
    setValidationErrors(result.valid ? [] : result.errors);
  };

  const lineCount = useMemo(() => {
    if (!value) {
      return 1;
    }
    let n = 1;
    for (let i = 0; i < value.length; i++) {
      if (value.charCodeAt(i) === 10) {
        n++;
      }
    }
    return n;
  }, [value]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full max-w-full flex-col gap-3 sm:max-w-xl">
        <div className="flex flex-col gap-1 pr-8">
          <SheetTitle>Block Kit JSON</SheetTitle>
          <SheetDescription>Edits update the preview as you type. Parse errors show below.</SheetDescription>
        </div>
        <div className="flex flex-1 overflow-hidden rounded-md border border-input bg-muted/30 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <div
            ref={gutterRef}
            aria-hidden="true"
            className="select-none overflow-hidden border-r border-input bg-muted/40 py-3 pr-2 pl-3 text-right font-mono text-xs leading-relaxed text-muted-foreground"
          >
            {Array.from({ length: lineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            ref={textareaRef}
            aria-label="Block Kit JSON"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onScroll={(e) => {
              if (gutterRef.current) {
                gutterRef.current.scrollTop = e.currentTarget.scrollTop;
              }
            }}
            spellCheck={false}
            className="flex-1 resize-none border-0 bg-transparent p-3 font-mono text-xs leading-relaxed text-foreground outline-none"
          />
        </div>
        {(parseError || validationErrors.length > 0) && (
          <div className="shrink-0 space-y-1.5 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
            {parseError && <p className="font-medium text-destructive">{parseError}</p>}
            {validationErrors.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-destructive/80">
                {validationErrors.slice(0, 6).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {validationErrors.length > 6 && <li>and {validationErrors.length - 6} more</li>}
              </ul>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
