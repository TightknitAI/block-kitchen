import { validateBlockKit } from '@tightknitai/slack-block-kit-validator';
import { Check, Copy } from 'lucide-react';
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
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acceptResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hold the latest blocks in a ref so the open-seed effect can read them
  // without listing them as a dependency. While the drawer is open the
  // textarea is the source of truth; external edits must not stomp typing.
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  });

  useEffect(() => {
    if (open) {
      const current = blocksRef.current;
      setValue(current.length === 0 ? '' : JSON.stringify(current, null, 2));
      setParseError(null);
      setValidationErrors([]);
      setCopied(false);
      setAccepted(false);
    }
  }, [open]);

  // Clear the "copied" and "accepted" reset timers on unmount.
  useEffect(
    () => () => {
      if (copyResetRef.current) {
        clearTimeout(copyResetRef.current);
      }
      if (acceptResetRef.current) {
        clearTimeout(acceptResetRef.current);
      }
    },
    []
  );

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        if (copyResetRef.current) {
          clearTimeout(copyResetRef.current);
        }
        copyResetRef.current = setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        // Clipboard can be unavailable (insecure context / denied); no-op.
      });
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (next.length > MAX_JSON_BYTES) {
      setParseError(`JSON exceeds the ${Math.round(MAX_JSON_BYTES / 1024)} KiB editor limit.`);
      setValidationErrors([]);
      return;
    }
    // A blank textarea (or one the user cleared entirely) is treated as an
    // empty block list rather than a parse error, so clearing the box to
    // paste something new doesn't flash red first.
    if (next.trim() === '') {
      setParseError(null);
      setValidationErrors([]);
      onApply([]);
      setAccepted(true);
      if (acceptResetRef.current) {
        clearTimeout(acceptResetRef.current);
      }
      acceptResetRef.current = setTimeout(() => setAccepted(false), 900);
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
    setAccepted(true);
    if (acceptResetRef.current) {
      clearTimeout(acceptResetRef.current);
    }
    acceptResetRef.current = setTimeout(() => setAccepted(false), 900);
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
        <div className="relative flex flex-1 overflow-hidden rounded-md border border-input bg-muted/30 shadow-sm focus-within:ring-1 focus-within:ring-ring">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? 'Copied to clipboard' : 'Copy JSON'}
            className="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md border border-input bg-background/80 p-1.5 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
          <div
            role="status"
            aria-hidden={!accepted}
            className={`pointer-events-none absolute bottom-2 right-2 z-10 flex items-center justify-center rounded-md bg-background/80 p-1.5 shadow-sm backdrop-blur transition-opacity duration-300 ${
              accepted ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span className="sr-only">Input accepted</span>
          </div>
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
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Done
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
