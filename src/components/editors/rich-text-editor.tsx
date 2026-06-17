import Link from '@tiptap/extension-link';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Code2,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RichTextBlock } from 'slack-web-api-client';
import { cn } from '../../lib/cn';
import { type EmojiIndex, loadEmojiIndex } from '../../lib/emoji-data';
import { makeEmojiImportResolver } from '../../lib/emoji-resolve';
import {
  detectLossy,
  type EmojiImportResolver,
  type LossyReason,
  proseMirrorToRichText,
  richTextToProseMirror
} from '../../lib/rich-text-tiptap';
import { EmojiNode } from '../../lib/tiptap-emoji-node';
import { Button } from '../../lib/ui/button';
import { Input } from '../../lib/ui/input';
import { Label } from '../../lib/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../../lib/ui/popover';
import { hasExplicitSafeScheme, isSafeHref } from '../../lib/url-safety';
import { useCustomEmojis } from '../../state/custom-emoji-context';
import { EmojiPickerButton } from '../emoji/emoji-picker-button';
import { RichTextStructuredEditor } from './rich-text-structured-editor';
import type { BlockEditorProps } from './types';

/**
 * WYSIWYG editor for rich_text blocks, backed by TipTap. Falls back to
 * the structured editor when the block uses features the WYSIWYG can't
 * round-trip (mentions, emoji, broadcasts, list indent, etc.). The user
 * can also opt into the structured editor via a "More options" toggle.
 * @param props - editor props
 * @param props.block - the rich_text block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered rich text editor form
 */
export function RichTextEditor({ block, onChange }: BlockEditorProps<RichTextBlock>) {
  const lossyReasons = detectLossy(block);

  if (lossyReasons.length > 0) {
    return (
      <div className="flex flex-col gap-3">
        <LossyBanner reasons={lossyReasons} />
        <RichTextStructuredEditor block={block} onChange={onChange} />
      </div>
    );
  }

  return <RichTextWysiwygEditor block={block} onChange={onChange} />;
}

/**
 * Inline notice shown above the structured editor when round-trip would lose data.
 * @param props - banner props
 * @param props.reasons - list of features that prevent WYSIWYG round-trip
 * @returns the rendered banner
 */
function LossyBanner({ reasons }: { reasons: LossyReason[] }) {
  const sample = reasons.slice(0, 3).map((r) => r.label);
  const more = reasons.length - sample.length;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
      <p className="font-medium">Editing in structured mode</p>
      <p className="leading-snug">
        This block uses features the rich editor can't preserve on a round trip ({sample.join(', ')}
        {more > 0 ? `, +${more} more` : ''}).
      </p>
    </div>
  );
}

/**
 * Markdown input rules to keep enabled, keyed by extension name. Passing an
 * allowlist to TipTap's `enableInputRules` disables every other rule. We
 * keep the inline mark shortcuts (`**bold**`, `*italic*`, `~~strike~~`,
 * `` `code` ``) but drop the block-level conversions (ordered/bullet list,
 * blockquote, code block) so that typing literal line-start text like `2. `
 * or `- ` in a Slack message is never swallowed into a list/quote/code
 * block. All formatting stays available via the toolbar. TipTap's inline
 * Markdown syntax also differs from Slack's (`*` is italic here, bold in
 * Slack), so these shortcuts are a convenience, not a fidelity feature.
 */
export const RICH_TEXT_INPUT_RULE_ALLOWLIST = ['bold', 'italic', 'strike', 'code'];

/**
 * Builds the TipTap extension set for the rich-text WYSIWYG editor. Kept as
 * a standalone factory (returning fresh instances per call) so the exact
 * production configuration can be exercised in tests.
 * @returns the configured TipTap extensions
 */
export function buildRichTextExtensions() {
  return [
    StarterKit.configure({
      heading: false,
      horizontalRule: false,
      // StarterKit bundles its own Link extension (enabled by default),
      // which would register a second, unconfigured `link` mark and a
      // duplicate autolinker alongside the hardened one we add below.
      // Disable it so our single, security-configured Link is the only
      // link extension in the schema.
      link: false
    }),
    EmojiNode,
    Link.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https',
      // Pin TipTap's link allowlist to the same set as our shared
      // `isSafeHref` helper. The upstream default also includes
      // ftp/cid/callto which we don't expect inside Slack content.
      protocols: ['http', 'https', 'mailto', 'tel', 'sms', 'xmpp'],
      // Belt-and-suspenders: even if a downstream contributor widens
      // `protocols` later, our isSafeHref guard rejects everything
      // outside the safe-link set. setLink and toggleLink both gate
      // on this hook before applying the mark.
      isAllowedUri: (url) => isSafeHref(url),
      // Only auto-link tokens that carry an explicit, safe scheme. TipTap's
      // default would link any `host.tld` (e.g. `2.xyz`, `report.zip`,
      // `logo.png`) because the suffix is a real gTLD, which is wrong for
      // free-form Slack message text. Deliberate links can still be added
      // via the link button.
      shouldAutoLink: hasExplicitSafeScheme,
      HTMLAttributes: { rel: 'noreferrer noopener', target: '_blank' }
    })
  ];
}

/**
 * TipTap-backed WYSIWYG editor for rich_text blocks that round-trip cleanly.
 * @param props - editor props
 * @param props.block - the rich_text block to edit
 * @param props.onChange - called with the updated block payload
 * @returns the rendered WYSIWYG editor
 */
function RichTextWysiwygEditor({ block, onChange }: { block: RichTextBlock; onChange: (next: RichTextBlock) => void }) {
  // Track the last payload we emitted so we can ignore parent re-renders
  // that just echo our own changes back, avoiding feedback loops.
  const lastEmittedRef = useRef<RichTextBlock | null>(null);

  const { byName: customByName } = useCustomEmojis();
  // Load the emoji dataset so import resolution can fill in glyph codepoints
  // for standard emoji. Held in state so the resolver rebuilds once loaded.
  const [emojiIndex, setEmojiIndex] = useState<EmojiIndex | null>(null);
  useEffect(() => {
    let active = true;
    loadEmojiIndex()
      .then((idx) => active && setEmojiIndex(idx))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const resolveEmoji = useMemo<EmojiImportResolver>(
    () => makeEmojiImportResolver(customByName, emojiIndex),
    [customByName, emojiIndex]
  );

  const handleUpdate = useCallback(
    (editor: Editor) => {
      const next = proseMirrorToRichText(editor.getJSON() as never);
      lastEmittedRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  const editor = useEditor({
    extensions: buildRichTextExtensions(),
    enableInputRules: RICH_TEXT_INPUT_RULE_ALLOWLIST,
    content: richTextToProseMirror(block, resolveEmoji) as never,
    editorProps: {
      attributes: {
        class:
          'bk-rich-editor min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:pl-5 [&_li]:my-0 [&_pre]:bg-muted [&_pre]:rounded [&_pre]:p-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground'
      }
    },
    onUpdate: ({ editor: ed }) => handleUpdate(ed)
  });

  // Keep editor in sync if the parent swaps in a different block
  // (e.g. the user opens a different rich_text block in the popover).
  useEffect(() => {
    if (!editor) {
      return;
    }
    if (lastEmittedRef.current && JSON.stringify(lastEmittedRef.current) === JSON.stringify(block)) {
      return;
    }
    editor.commands.setContent(richTextToProseMirror(block, resolveEmoji) as never, {
      emitUpdate: false
    });
  }, [block, editor, resolveEmoji]);

  if (!editor) {
    return <div className="min-h-[120px] rounded-md border border-input bg-background" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

/**
 * Formatting toolbar for the WYSIWYG editor (marks, lists, blocks, undo/redo).
 * @param props - toolbar props
 * @param props.editor - the TipTap editor instance to drive
 * @returns the rendered toolbar
 */
function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-md border bg-muted/30 p-1">
      <ToolbarButton
        label="Bold"
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        Icon={Bold}
      />
      <ToolbarButton
        label="Italic"
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        Icon={Italic}
      />
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        Icon={Strikethrough}
      />
      <ToolbarButton
        label="Underline"
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        Icon={Underline}
      />
      <ToolbarButton
        label="Inline code"
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        Icon={Code}
      />
      <Divider />
      <LinkPopover editor={editor} />
      <EmojiPickerButton
        align="start"
        onSelect={(sel) =>
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'emoji',
              attrs: { name: sel.name, src: sel.src, unicode: sel.unicode, skinTone: sel.skinTone }
            })
            .run()
        }
      />
      <Divider />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        Icon={List}
      />
      <ToolbarButton
        label="Ordered list"
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        Icon={ListOrdered}
      />
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        Icon={Quote}
      />
      <ToolbarButton
        label="Code block"
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        Icon={Code2}
      />
      <Divider />
      <ToolbarButton
        label="Undo"
        active={false}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
        Icon={Undo2}
      />
      <ToolbarButton
        label="Redo"
        active={false}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
        Icon={Redo2}
      />
    </div>
  );
}

/**
 * Single icon button in the formatting toolbar.
 * @param props - button props
 * @param props.label - accessible label and tooltip text
 * @param props.active - whether the formatting at the cursor matches this button
 * @param props.disabled - whether the action is currently unavailable
 * @param props.onClick - called when the user activates the button
 * @param props.Icon - the lucide icon component to render
 * @returns the rendered toolbar button
 */
function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  Icon
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  Icon: typeof Bold;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-accent text-foreground',
        disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * Thin vertical separator used between toolbar groups.
 * @returns the rendered divider element
 */
function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-border" />;
}

/**
 * Toolbar control that opens a popover for setting or removing a link mark.
 * @param props - popover props
 * @param props.editor - the TipTap editor instance to drive
 * @returns the rendered link popover trigger and content
 */
function LinkPopover({ editor }: { editor: Editor }) {
  const active = editor.isActive('link');
  const currentHref = (editor.getAttributes('link').href as string | undefined) ?? '';
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(currentHref);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl(currentHref);
      setError(null);
    }
  }, [open, currentHref]);

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      setOpen(false);
      return;
    }
    if (!isSafeHref(trimmed)) {
      setError('Only http(s), mailto, tel, sms, and xmpp links are allowed.');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Link"
          title="Link"
          className={cn(
            'flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            active && 'bg-accent text-foreground'
          )}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="rt-link-url" className="text-xs">
            URL
          </Label>
          <Input
            id="rt-link-url"
            value={url}
            placeholder="https://example.com"
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) {
                setError(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
          />
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <div className="flex justify-between">
            {active ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" size="sm" onClick={apply}>
              {active ? 'Update' : 'Add link'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
