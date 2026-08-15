import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { isSafeImageSrc } from '../../lib/url-safety';
import type { PreviewHooks, PreviewTheme, SupportedBlock } from '../../types';
import { SlackBlockPreview } from './slack-block-preview';

/** Placeholder time shown when the caller has no real timestamp to render. */
const PLACEHOLDER_TIME = '10:37 AM';

/**
 * Slack message chrome: avatar + author name + timestamp across the top,
 * blocks below. Mimics the library's `<Message>` wrapper without wiring each
 * block through its own library wrapper (so per-block editing affordances
 * still work inside it).
 *
 * Shared by the builder surface (interactive rows) and the find dialog's
 * preview pane (read-only), so a loaded message looks the same in both.
 * @param props - frame props
 * @param props.workspaceName - cosmetic app name shown in the header
 * @param props.authorName - the message author's display name; overrides `workspaceName`
 * @param props.authorIcon - the author's avatar URL; ignored unless a safe image URL
 * @param props.time - timestamp text. Defaults to a fixed placeholder; pass `''` to omit it
 * @param props.isDark - whether to apply the dark Slack canvas colors
 * @param props.children - the blocks list to render inside the frame
 * @returns the rendered message frame
 */
export function SlackMessageFrame({
  workspaceName,
  authorName,
  authorIcon,
  time = PLACEHOLDER_TIME,
  isDark,
  children
}: {
  workspaceName?: string;
  authorName?: string;
  authorIcon?: string;
  time?: string;
  isDark: boolean;
  children: ReactNode;
}) {
  const displayName = authorName ?? workspaceName ?? 'Your app';
  const initial = displayName.slice(0, 1).toUpperCase();
  // Only render the author image when it's a safe http(s) URL — it flows into
  // an <img src> just like block image URLs do.
  const safeIcon = authorIcon && isSafeImageSrc(authorIcon) ? authorIcon : null;
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-md border',
        isDark ? 'border-[#2c2d30] bg-[#1a1d21]' : 'border-[#e8e8e8] bg-white'
      )}
    >
      <div
        className={cn('flex items-center gap-2 px-5 pt-3 pb-1 text-xs', isDark ? 'text-white/60' : 'text-[#616061]')}
      >
        {safeIcon ? (
          <img src={safeIcon} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
        ) : (
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded text-[12px] font-semibold',
              isDark ? 'bg-white/10 text-white' : 'bg-[#4a154b]/10 text-[#1d1c1d]'
            )}
          >
            {initial}
          </span>
        )}
        <span className={cn('font-bold text-sm', isDark ? 'text-white' : 'text-[#1d1c1d]')}>{displayName}</span>
        {time ? <span>{time}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Read-only render of a whole Slack message: the shared message chrome from
 * {@link SlackMessageFrame} wrapped around one {@link SlackBlockPreview} per
 * block. Used by the find dialog's preview pane so what the user previews is
 * rendered by the same pipeline (sanitizing, emoji / mention hooks, theme)
 * the builder uses after the message loads.
 * @param props - preview props
 * @param props.blocks - the message's blocks, in order
 * @param props.hooks - optional directive replacement hooks
 * @param props.theme - light or dark preview theme (default 'light')
 * @param props.workspaceName - cosmetic app name shown in the header
 * @param props.authorName - the message author's display name; overrides `workspaceName`
 * @param props.authorIcon - the author's avatar URL; ignored unless a safe image URL
 * @param props.time - timestamp text shown beside the author
 * @param props.emptyLabel - copy shown in place of the blocks when there are none
 * @returns the rendered message preview
 */
export function SlackMessagePreview({
  blocks,
  hooks,
  theme = 'light',
  workspaceName,
  authorName,
  authorIcon,
  time,
  emptyLabel = 'This message has no blocks to preview.'
}: {
  blocks: SupportedBlock[];
  hooks?: PreviewHooks;
  theme?: PreviewTheme;
  workspaceName?: string;
  authorName?: string;
  authorIcon?: string;
  time?: string;
  emptyLabel?: string;
}) {
  const isDark = theme === 'dark';
  return (
    <SlackMessageFrame
      workspaceName={workspaceName}
      authorName={authorName}
      authorIcon={authorIcon}
      time={time}
      isDark={isDark}
    >
      <div className={cn('flex min-w-0 flex-col gap-1 px-5 pb-3', isDark ? 'bg-[#1a1d21]' : 'bg-white')}>
        {blocks.length === 0 ? (
          <p className={cn('py-1 text-sm', isDark ? 'text-white/60' : 'text-[#616061]')}>{emptyLabel}</p>
        ) : (
          blocks.map((block, index) => (
            <SlackBlockPreview key={`${block.type}-${index}`} block={block} hooks={hooks} theme={theme} />
          ))
        )}
      </div>
    </SlackMessageFrame>
  );
}
