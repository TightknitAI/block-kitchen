import type {
  ActionsBlock,
  ContextBlock,
  DividerBlock,
  HeaderBlock,
  ImageBlock,
  ImageElement,
  RichTextBlock,
  SectionBlock,
  Button as SlackButton,
  ViewInputBlock
} from 'slack-web-api-client';
import type { BrandPreset, BrandTheme } from './lib/brand-theme';
import type { PaletteSection } from './lib/default-blocks';

/**
 * The Slack Block Kit block types supported by the builder in v1.
 */
export type SupportedBlockType =
  | 'section'
  | 'header'
  | 'divider'
  | 'context'
  | 'actions'
  | 'image'
  | 'markdown'
  | 'rich_text'
  | 'table'
  | 'alert'
  | 'card'
  | 'carousel'
  | 'context_actions'
  | 'input'
  | 'video'
  | 'plan'
  | 'task_card'
  | 'data_visualization'
  | 'container';

/**
 * Slack `markdown` block payload. Renders standard markdown (GFM)
 * via `slack-blocks-to-jsx`'s react-markdown integration.
 * `slack-web-api-client` doesn't ship this type yet, so we declare
 * the minimal shape ourselves.
 */
export interface MarkdownBlock {
  type: 'markdown';
  text: string;
  block_id?: string;
}

/**
 * One cell in a {@link TableBlock} row. Slack accepts either a raw text
 * cell or a rich-text cell; the visual editor only emits raw text in v1
 * but preserves rich-text cells on edit.
 */
export type TableCell = { type: 'raw_text'; text: string } | { type: 'rich_text'; elements: unknown[] };

/**
 * Per-column setting in a {@link TableBlock}. May be null to skip a
 * column. Matches Slack's `table_column_setting` schema.
 */
export type TableColumnSetting = null | {
  align?: 'left' | 'center' | 'right';
  is_wrapped?: boolean;
};

/**
 * Slack `table` block payload. Up to 100 rows, 20 cells per row.
 * `slack-web-api-client` doesn't ship this type, so we declare it.
 */
export interface TableBlock {
  type: 'table';
  rows: TableCell[][];
  column_settings?: TableColumnSetting[];
  block_id?: string;
}

/**
 * Severity level for an {@link AlertBlock}. Controls the icon and color
 * accent rendered by Slack. Defaults to `default` when omitted.
 */
export type AlertLevel = 'default' | 'info' | 'warning' | 'error' | 'success';

/**
 * Slack `alert` block payload. Single-line status notification with an
 * optional severity level. Per Slack's surface compatibility rules, alert
 * blocks render on modal surfaces only (not messages or home tabs).
 * `slack-web-api-client` doesn't ship this type yet, so we declare it.
 */
export interface AlertBlock {
  type: 'alert';
  text: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
    verbatim?: boolean;
  };
  level?: AlertLevel;
  block_id?: string;
}

/**
 * Slack `card` block payload. Renders a media-rich card with optional
 * hero image, icon, title, subtitle, body, and action buttons. At least
 * one of `hero_image`, `title`, `actions`, or `body` is required.
 * `slack-web-api-client` doesn't ship this type yet, so we declare it.
 */
export interface CardBlock {
  type: 'card';
  block_id?: string;
  hero_image?: ImageElement;
  icon?: ImageElement;
  title?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
    verbatim?: boolean;
  };
  subtitle?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
    verbatim?: boolean;
  };
  body?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
    verbatim?: boolean;
  };
  actions?: SlackButton[];
}

/**
 * Slack `carousel` block payload. A horizontally scrollable group of
 * 1-10 {@link CardBlock} elements. `slack-web-api-client` doesn't ship
 * this type yet, so we declare it.
 */
export interface CarouselBlock {
  type: 'carousel';
  elements: CardBlock[];
  block_id?: string;
}

/**
 * Sub-button used inside a {@link FeedbackButtonsElement}.
 */
export interface FeedbackButtonSubobject {
  text: { type: 'plain_text'; text: string; emoji?: boolean };
  value: string;
  accessibility_label?: string;
}

/**
 * `feedback_buttons` element. Pair of positive/negative buttons used
 * inside a {@link ContextActionsBlock} (e.g. "Good Response" / "Bad
 * Response" thumbs).
 */
export interface FeedbackButtonsElement {
  type: 'feedback_buttons';
  positive_button: FeedbackButtonSubobject;
  negative_button: FeedbackButtonSubobject;
  action_id?: string;
}

/**
 * Slack icon names valid on an {@link IconButtonElement}. Slack only
 * ships `trash` today; widen as Slack adds more.
 */
export type IconButtonIcon = 'trash';

/**
 * `icon_button` element. Compact icon-with-label button used inside a
 * {@link ContextActionsBlock} (e.g. a "Remove" trash-icon button).
 */
export interface IconButtonElement {
  type: 'icon_button';
  icon: IconButtonIcon;
  text: { type: 'plain_text'; text: string; emoji?: boolean };
  action_id?: string;
  value?: string;
  accessibility_label?: string;
}

/**
 * Element accepted by a {@link ContextActionsBlock}.
 */
export type ContextActionsElement = FeedbackButtonsElement | IconButtonElement;

/**
 * Slack `context_actions` block payload. Renders a row of contextual
 * action buttons (1-5 elements) attached to a message. Only valid on
 * the message surface; the validator already encodes that.
 * `slack-web-api-client` doesn't ship this type yet, so we declare it.
 */
export interface ContextActionsBlock {
  type: 'context_actions';
  elements: ContextActionsElement[];
  block_id?: string;
}

/**
 * Slack `input` block payload. Aliased to `ViewInputBlock` from
 * `slack-web-api-client`, which is the superset that accepts every
 * supported input element (including `rich_text_input` and `file_input`).
 * Surface compatibility (input is valid on modal and home tab; some
 * elements are modal-only) is enforced by the validator, not the type.
 */
export type InputBlock = ViewInputBlock;

/**
 * Slack `video` block payload. Renders an embedded video player with
 * thumbnail, title, optional description, and provider metadata. Sending
 * requires the `links.embed:write` OAuth scope and `video_url` to live in
 * the app's configured unfurl domains. `slack-web-api-client` doesn't ship
 * this type yet, so we declare it.
 */
export interface VideoBlock {
  type: 'video';
  alt_text: string;
  title: { type: 'plain_text'; text: string; emoji?: boolean };
  thumbnail_url: string;
  video_url: string;
  author_name?: string;
  description?: { type: 'plain_text'; text: string; emoji?: boolean };
  provider_icon_url?: string;
  provider_name?: string;
  title_url?: string;
  block_id?: string;
}

/**
 * Status of a {@link TaskCardBlock} as shown by Slack. `pending`,
 * `in_progress`, and `complete` render distinct status chips; `error`
 * renders a failure state.
 */
export type TaskCardStatus = 'pending' | 'in_progress' | 'complete' | 'error';

/**
 * URL source attached to a {@link TaskCardBlock}. Rendered as a labeled
 * link below the task body so agents can cite which document, ticket, or
 * page their step consulted.
 */
export interface UrlSourceElement {
  type: 'url';
  url: string;
  text: string;
}

/**
 * Slack `task_card` block payload. Renders an agent-facing card showing a
 * tracked task with optional details (rich text), output (rich text), and
 * cited sources. Valid on message surfaces only.
 * `slack-web-api-client` doesn't ship this type yet, so we declare it.
 */
export interface TaskCardBlock {
  type: 'task_card';
  task_id: string;
  title: string;
  details?: RichTextBlock;
  output?: RichTextBlock;
  sources?: UrlSourceElement[];
  status?: TaskCardStatus;
  block_id?: string;
}

/**
 * Slack `plan` block payload. Renders a titled checklist of tasks an
 * agent is executing. Each task is an inline {@link TaskCardBlock}.
 * Valid on message surfaces only. `slack-web-api-client` doesn't ship
 * this type yet, so we declare it.
 */
export interface PlanBlock {
  type: 'plan';
  title: string | { type: 'plain_text'; text: string; emoji?: boolean };
  tasks?: TaskCardBlock[];
  block_id?: string;
}

/**
 * One `{ label, value }` data point inside a {@link ChartSeries}. `label`
 * is the x-axis category the point belongs to; `value` is the numeric
 * measurement and may be negative.
 */
export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * A named series of {@link ChartDataPoint}s. Line / bar / area charts may
 * carry one or more series; each renders as its own line, set of bars, or
 * filled region with a matching legend entry.
 */
export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
}

/**
 * Axis configuration shared by the cartesian chart types (line / bar /
 * area). `categories` is the ordered set of x-axis tick labels; `x_label`
 * and `y_label` title the axes.
 */
export interface ChartAxisConfig {
  categories: string[];
  x_label?: string;
  y_label?: string;
}

/**
 * One `{ label, value }` slice of a {@link PieChart}.
 */
export interface PieChartSegment {
  label: string;
  value: number;
}

/**
 * Cartesian chart spec (line / bar / area) used by a
 * {@link DataVisualizationBlock}: one or more named series plotted against
 * a shared category axis.
 */
export interface CartesianChart {
  type: 'line' | 'bar' | 'area';
  series: ChartSeries[];
  axis_config?: ChartAxisConfig;
}

/**
 * Pie chart spec used by a {@link DataVisualizationBlock}. Unlike the
 * cartesian charts it has no axes — just a flat list of labeled segments.
 */
export interface PieChart {
  type: 'pie';
  segments: PieChartSegment[];
}

/**
 * The `chart` payload of a {@link DataVisualizationBlock}: either a
 * cartesian chart (line / bar / area) or a pie chart.
 */
export type Chart = CartesianChart | PieChart;

/**
 * The chart shape rendered by a {@link DataVisualizationBlock}.
 */
export type ChartType = Chart['type'];

/**
 * Slack `data_visualization` block payload. Renders a line, bar, area, or
 * pie chart from inline data. Valid on the message surface only.
 * `slack-web-api-client` doesn't ship this type yet, so we declare it.
 * @see https://docs.slack.dev/reference/block-kit/blocks/data-visualization-block
 */
export interface DataVisualizationBlock {
  type: 'data_visualization';
  title: string;
  chart: Chart;
  block_id?: string;
}

/**
 * A block allowed inside a {@link ContainerBlock}'s `child_blocks` array.
 * Slack permits actions, context, divider, file, header, image, input,
 * rich_text, section, table, and video — notably not `container` itself
 * (no nesting) nor message-only chrome like card / carousel / markdown.
 * This mirrors that set across the block types the builder models (`file`
 * is omitted because the builder has no file block).
 * @see https://docs.slack.dev/reference/block-kit/blocks/container-block
 */
export type ContainerChildBlock =
  | SectionBlock
  | SupportedHeaderBlock
  | DividerBlock
  | ContextBlock
  | ActionsBlock
  | ImageBlock
  | RichTextBlock
  | TableBlock
  | InputBlock
  | VideoBlock;

/**
 * Slack `container` block payload. A general-purpose wrapper that groups
 * 1-10 child blocks into a single, optionally collapsible unit with a
 * configurable width. Valid on the message surface only.
 * `default_collapsed` only takes effect when `is_collapsible` is true.
 *
 * Note: despite what the API reference says, `title` and `subtitle` are
 * `plain_text` text objects, not plain strings. `slack-web-api-client`
 * doesn't ship this type yet, so we declare it.
 * @see https://docs.slack.dev/reference/block-kit/blocks/container-block
 */
export interface ContainerBlock {
  type: 'container';
  title: { type: 'plain_text'; text: string; emoji?: boolean };
  child_blocks: ContainerChildBlock[];
  subtitle?: { type: 'plain_text'; text: string; emoji?: boolean };
  icon?: ImageElement;
  width?: 'narrow' | 'standard' | 'wide' | 'full';
  is_collapsible?: boolean;
  default_collapsed?: boolean;
  block_id?: string;
}

/**
 * Header heading level shown in the preview. Slack's API has no
 * `level` field on header blocks, so this is a builder-only extension
 * that round-trips on the block payload but is otherwise cosmetic.
 */
export type HeaderLevel = 1 | 2 | 3 | 4;

/**
 * Header block as edited by the builder. Extends Slack's HeaderBlock
 * with an optional {@link HeaderLevel}.
 */
export type SupportedHeaderBlock = HeaderBlock & { level?: HeaderLevel };

/**
 * Discriminated union of supported block payload shapes.
 * Subset of {@link AnyMessageBlock} from `slack-web-api-client`,
 * plus a header `level` extension.
 */
export type SupportedBlock =
  | SectionBlock
  | SupportedHeaderBlock
  | DividerBlock
  | ContextBlock
  | ActionsBlock
  | ImageBlock
  | MarkdownBlock
  | RichTextBlock
  | TableBlock
  | AlertBlock
  | CardBlock
  | CarouselBlock
  | ContextActionsBlock
  | InputBlock
  | VideoBlock
  | PlanBlock
  | TaskCardBlock
  | DataVisualizationBlock
  | ContainerBlock;

/**
 * A block as represented inside the builder's working state.
 * `id` is an ephemeral client-side identifier used by DnD and selection.
 * It is stripped before serialization to Slack.
 *
 * For `container` blocks, `children` holds the wrapped child blocks and is
 * the authoritative store for drag-and-drop identity; `block.child_blocks`
 * is kept mirrored from it so the payload stays valid for serialization,
 * validation, and preview without those paths needing to know about the
 * nesting. `children` is absent for every other block type.
 */
export interface BuilderBlock {
  id: string;
  block: SupportedBlock;
  children?: BuilderBlock[];
}

/**
 * Channel record returned by {@link BlockKitchenProps.loadChannels}.
 */
export interface ChannelOption {
  id: string;
  name: string;
}

/**
 * User-token status returned by {@link BlockKitchenProps.loadSendAsUserStatus}.
 * If `canSendAsUser` is false, `oauthUrl` is required so the UI can show a
 * "Sign in with Slack" link.
 */
export interface SendAsUserStatus {
  canSendAsUser: boolean;
  oauthUrl?: string;
}

/**
 * Payload passed to {@link BlockKitchenProps.onSend}.
 */
export interface SendPayload {
  channelId: string;
  blocks: SupportedBlock[];
  sendAsUser: boolean;
}

/**
 * Result returned from {@link BlockKitchenProps.onSend}.
 * `error` is a human-readable message; the dialog renders it as-is.
 */
export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Which token can edit a loaded message, as computed by the host.
 * `chat.update` only edits a message authored by the calling token:
 * - `'bot'` — the message was posted by this app; edit via the bot token.
 * - `'user'` — the message was posted by the current user; edit via their
 *   user token (gated behind {@link BlockKitchenProps.loadSendAsUserStatus}).
 */
export type EditableVia = 'bot' | 'user';

/**
 * Input passed to {@link EditingConfig.onLoadMessage}. The user pastes a
 * Slack message permalink (Slack's "Copy link"); the host parses
 * `channel + ts` out of it — the package never touches raw timestamps.
 */
export interface LoadMessageInput {
  link: string;
}

/**
 * Result of loading an existing message for editing, computed by the host.
 *
 * On `ok`, the package enters edit mode: it hydrates the editor with
 * `blocks`, locks the destination to `channelId`, and constrains the
 * post-as identity to `editableVia`.
 *
 * On `!ok`, the package renders the host's `reason` inline and offers
 * "Open as a new message instead". If the message round-trips through the
 * block editor (e.g. someone else's block message), the host may include
 * `blocks` so that fallback can hydrate the draft; for non-block or
 * attachment-only messages, omit it.
 */
export type LoadResult =
  | {
      ok: true;
      channelId: string;
      /** Channel name for the edit-mode badge (display only). Falls back to `channelId`. */
      channelName?: string;
      ts: string;
      blocks: SupportedBlock[];
      editableVia: EditableVia;
      workspaceName?: string;
    }
  | { ok: false; reason: string; blocks?: SupportedBlock[] };

/**
 * Payload passed to {@link EditingConfig.onUpdate}. Sibling to
 * {@link SendPayload} but carries the source `channel + ts`. `chat.update`
 * requires re-sending the full blocks payload (no partial update).
 */
export interface UpdatePayload {
  channelId: string;
  ts: string;
  blocks: SupportedBlock[];
  asUser: boolean;
}

/**
 * Result returned from {@link EditingConfig.onUpdate}. Mirrors
 * {@link SendResult}; `error` is rendered as-is.
 */
export interface UpdateResult {
  ok: boolean;
  error?: string;
}

/**
 * One entry in the "recent messages from this app" picker, returned by
 * {@link EditingConfig.loadRecentMessages}. These are editable-by-construction
 * — the app authored them — so they load straight into edit mode without a
 * separate verdict round-trip. `editableVia` defaults to `'bot'` when omitted.
 */
export interface RecentMessage {
  channelId: string;
  /** Channel name for display + the edit-mode badge. Falls back to `channelId`. */
  channelName?: string;
  ts: string;
  blocks: SupportedBlock[];
  editableVia?: EditableVia;
  /** Short preview shown in the picker row (e.g. the first line of the message). */
  label?: string;
  workspaceName?: string;
}

/**
 * Opt-in edit-mode configuration. Presence of {@link BlockKitchenProps.editing}
 * enables loading an existing message and dispatching an update; omit it to
 * keep the send-only behavior. The package stays integration-agnostic — it
 * makes no network calls and has no Slack-token knowledge; the host brokers
 * I/O and computes the editability verdict.
 */
export interface EditingConfig {
  /**
   * Host parses the pasted permalink, fetches the message, and returns a
   * host-computed editability verdict plus blocks. See {@link LoadResult}.
   */
  onLoadMessage: (input: LoadMessageInput) => Promise<LoadResult>;
  /**
   * Dispatches the update for the loaded message. Sibling to
   * {@link BlockKitchenProps.onSend}; carries `channel + ts`.
   */
  onUpdate: (payload: UpdatePayload) => Promise<UpdateResult>;
  /**
   * Optional. When provided, the load dialog adds a "recent messages from this
   * app" picker alongside the paste-a-link input. Returns messages the app
   * authored (editable-by-construction); picking one loads it straight into
   * edit mode. Omit to offer the paste-link entry only.
   */
  loadRecentMessages?: () => Promise<RecentMessage[]>;
}

/**
 * A workspace custom emoji as configured in Slack. Mirrors the shape Slack's
 * `emoji.list` API returns once normalized:
 *
 * - `name` — the codename used between colons (`:partyparrot:` → `partyparrot`).
 * - `url` — the hosted image for a true custom emoji, or `null` when the entry
 *   is an alias of another emoji (standard or custom).
 * - `alias` — the target codename when this entry aliases another emoji, or
 *   `null` for a first-class image emoji.
 *
 * Passed to {@link BlockKitchenProps.customEmojis} so the preview can render
 * `:custom:` as the workspace image (and resolve aliases). The prop is
 * preview/picker-only — these fields are never serialized into the emitted
 * Block Kit JSON.
 */
export interface CustomEmoji {
  name: string;
  url: string | null;
  alias: string | null;
}

/**
 * Hooks forwarded to `slack-blocks-to-jsx`'s `<Message>` so the consumer can
 * resolve user mentions, channel mentions, custom emojis, and links to
 * application-specific UI. See the upstream library for the full hook shape.
 * Marked as `unknown`-keyed at this layer to avoid leaking the upstream
 * library's internal types into our public API.
 */
export type PreviewHooks = Record<string, unknown>;

/**
 * Light or dark theme for the rendered Slack preview. Wired to
 * `slack-blocks-to-jsx`'s `theme` prop and `data-theme` attribute.
 */
export type PreviewTheme = 'light' | 'dark';

/**
 * Which Slack surface the preview is approximating. Affects the
 * chrome rendered around the block list (message header, modal frame,
 * or app home tab).
 */
export type PreviewSurface = 'message' | 'modal' | 'app_home';

/**
 * A reusable block layout the user can apply as a starting point.
 * Consumed by the standalone `<TemplatePicker>` component, which renders
 * a categorized grid of template cards (modeled on Slack's own Block
 * Kit Builder templates page) and emits the selected one. The picker
 * is decoupled from {@link BlockKitchen} — wire `onSelect` to whatever
 * state owns the draft blocks (e.g. lift `initialBlocks` into your own
 * state and reset it from the handler).
 */
export interface Template {
  /** Stable identifier used as the React key and for persistence. */
  id: string;
  /** Display name shown on the template card. */
  name: string;
  /** Optional one-line description shown under the name on the card. */
  description?: string;
  /**
   * Which Slack surface this template was authored for. The picker can
   * filter to a single surface via its `surface` prop; the field is also
   * available to consumers who render templates in their own UI.
   */
  surface: PreviewSurface;
  /**
   * Optional category name used to group templates into sections in the
   * picker (e.g. `"Approvals"`, `"Notifications"`, `"Onboarding"`).
   * Templates without a category fall into a trailing "Other" section
   * when at least one other template specifies one; otherwise the grid
   * is rendered flat without section headers.
   */
  category?: string;
  /** Block payloads applied to the draft when the template is selected. */
  blocks: SupportedBlock[];
}

/**
 * Props for the top-level {@link BlockKitchen} component.
 * The package is integration-agnostic: every I/O concern is brokered
 * through these props. The component never makes a network call itself.
 */
export interface BlockKitchenProps {
  /**
   * Workspace name shown in the preview chrome to mimic a Slack message header.
   * Cosmetic only.
   */
  workspaceName?: string;
  /**
   * Initial draft blocks. If omitted the builder starts empty.
   */
  initialBlocks?: SupportedBlock[];
  /**
   * Fires whenever the draft state changes. Use to persist the draft
   * (URL search param, localStorage, etc).
   */
  onChange?: (blocks: SupportedBlock[]) => void;
  /**
   * Optional hooks forwarded to the underlying `<Message>` component for
   * resolving user / channel / emoji directives. If omitted, those
   * directives render with the library's defaults.
   */
  previewHooks?: PreviewHooks;
  /**
   * Workspace custom emoji (`emoji.list`) the preview should resolve. Entries
   * with a non-null `url` render as the workspace image; alias entries fall
   * back to their target emoji. Optional and backward compatible: when omitted,
   * `:custom:` directives render with the library's defaults.
   *
   * Provided to the builder tree via context so editors can offer a custom
   * emoji category without prop-drilling. The prop only affects rendering — it
   * is never serialized into the emitted Block Kit JSON.
   */
  customEmojis?: CustomEmoji[];
  /**
   * Returns channels available to send to. Called when the send dialog opens.
   */
  loadChannels: () => Promise<ChannelOption[]>;
  /**
   * Returns whether the current user can post as themselves and, if not, an
   * OAuth URL to start the install flow.
   */
  loadSendAsUserStatus: () => Promise<SendAsUserStatus>;
  /**
   * Called when the user submits the send dialog. Should return
   * `{ ok: true }` on success or `{ ok: false, error }` on failure.
   */
  onSend: (payload: SendPayload) => Promise<SendResult>;
  /**
   * Opt-in edit mode. When provided, the toolbar exposes an "Edit existing
   * message" entry: the user pastes a Slack message link, the host loads it
   * and returns an editability verdict ({@link EditingConfig.onLoadMessage}),
   * and a successful load flips the primary action from Send to "Update
   * message" ({@link EditingConfig.onUpdate}). Omit to keep today's send-only
   * behavior. The user-token path reuses {@link BlockKitchenProps.loadSendAsUserStatus}.
   */
  editing?: EditingConfig;
  /**
   * Label + accessible name for the toolbar button that opens the
   * load-message dialog (the edit-mode entry point). Defaults to
   * `'Load message'`. Only shown when {@link BlockKitchenProps.editing} is set
   * and no message is currently loaded.
   */
  loadButtonLabel?: string;
  /**
   * Label for the toolbar's primary button when a message is loaded for
   * editing. The button is a split control: clicking it updates the message
   * in place; a menu beside it also offers "Send as a new message" (post the
   * current blocks as a brand-new message). Defaults to `'Review & update'`.
   */
  updateButtonLabel?: string;
  /**
   * Label for the update dialog's final confirm button, which dispatches the
   * update via {@link EditingConfig.onUpdate}. Defaults to `'Update message'`
   * (and shows `'Updating…'` while in flight).
   */
  confirmUpdateLabel?: string;
  /**
   * The palette shown on the left-hand side. When omitted, the built-in
   * `defaultPalette` is used. Pass a custom array (typically built by
   * spreading and filtering `defaultPalette`, plus your own sections) to
   * curate the variants and pre-configured presets your users can drag
   * onto the surface. An empty array renders an empty palette.
   *
   * The `defaultPalette` mirrors Slack's Block Kit Builder, which
   * consolidates related variants into single showcase entries (e.g.
   * **All selects** is one `actions` block with every select type). If
   * you previously relied on the long flat list of single-element
   * `input` variants (`input_users_select`, `input_multi_users_select`,
   * `input_radio_buttons`, etc.), import `legacyInputVariants` and
   * spread them into a custom section.
   *
   * Variant ids must be unique across the array — the drag-drop lookup
   * keys by id, so duplicates would shadow each other. The palette is
   * also expected to be referentially stable across renders (wrap in
   * `useMemo` or define at module scope).
   */
  palette?: readonly PaletteSection[];
  /**
   * Block types to hide from the palette without rebuilding it. Each
   * palette section is keyed by a `blockType`; any section whose
   * `blockType` matches an entry here is filtered out before render.
   * Convenient when you want the default palette minus a few block
   * types (e.g. `disabledBlockTypes: ['image', 'table']` for a
   * text-only builder). For finer-grained control (filtering
   * individual variants, reordering, or adding custom presets), pass
   * a custom `palette` array instead.
   */
  disabledBlockTypes?: readonly SupportedBlockType[];
  /**
   * Whether the palette renders a quick-search input above the section
   * list. Defaults to `true`. Set `false` for compact palettes (e.g.
   * when you've passed a small custom `palette`) where scanning by eye
   * is faster than typing.
   */
  showPaletteSearch?: boolean;
  /**
   * Placeholder text for the palette search input. Defaults to
   * `'Search blocks…'`. Useful for localization.
   */
  paletteSearchPlaceholder?: string;
  /**
   * Controls which palette section headers are expanded on first paint.
   * - `true` (default) — every section starts open
   * - `false` — every section starts closed (Slack-style)
   * - array of section names — only sections whose `name` is in the
   *   list start open (e.g. `['Section', 'Actions']`); matched
   *   case-sensitively against `PaletteSection.name` so consumer-defined
   *   sections are addressable too.
   *
   * After mount, each section owns its own collapse state, so users can
   * still toggle headers freely. An active palette search overrides the
   * collapse state for matching sections.
   */
  defaultOpenSections?: boolean | readonly string[];
  /**
   * Which Slack preview surfaces the toolbar exposes. Defaults to
   * `['message']`, which locks the preview to Message and hides the
   * surface dropdown. Pass two or more to show the dropdown with those
   * options; the first entry becomes the initial selection.
   */
  allowedSurfaces?: readonly PreviewSurface[];
  /**
   * Whether the toolbar exposes the light/dark theme dropdown.
   * Defaults to `true`. When `false`, the theme is locked to
   * {@link BlockKitchenProps.defaultPreviewTheme} (or `'light'`).
   *
   * Ignored when {@link BlockKitchenProps.previewTheme} is provided — a
   * controlled theme always hides the toggle.
   */
  showThemeControl?: boolean;
  /**
   * Customizes or hides the "Docs" link in the toolbar.
   * - `undefined` (default) — links to the Slack Block Kit reference docs
   * - `false` — hides the link entirely
   * - `{ href }` — overrides the URL (label defaults to `'Docs'`)
   * - `{ href, label }` — overrides both
   *
   * Useful when embedding Block Kitchen inside a product that ships its
   * own documentation, or for localizing the label.
   */
  docsLink?: false | { href?: string; label?: string };
  /**
   * Initial preview theme (uncontrolled). Defaults to `'light'`. Pass the
   * host app's current theme (e.g. from `next-themes` or your own theme
   * hook) so the preview opens matched to the consuming app's appearance.
   * The user can still override via the toolbar dropdown if
   * {@link BlockKitchenProps.showThemeControl} is `true`.
   *
   * Used only as the initial value when {@link BlockKitchenProps.previewTheme}
   * is `undefined`. When `previewTheme` is provided, the preview is fully
   * controlled and this prop is ignored.
   */
  defaultPreviewTheme?: PreviewTheme;
  /**
   * Controlled preview theme. When provided, the preview renders in this
   * theme, updates reactively whenever it changes, and the toolbar's
   * light/dark toggle is hidden entirely so the host app fully owns the
   * theme. Leave `undefined` to keep the preview uncontrolled — it seeds
   * from {@link BlockKitchenProps.defaultPreviewTheme} and the toggle is
   * shown (subject to {@link BlockKitchenProps.showThemeControl}).
   */
  previewTheme?: PreviewTheme;
  /**
   * Label for the toolbar's Send button, which opens the send dialog.
   * Defaults to `'Review & send'` (the dialog is the review step). Use this to
   * override the copy (e.g. `'Send to channel…'`) without hardcoding
   * product-specific text in the package. Also used as the button's
   * accessible name.
   */
  sendButtonLabel?: string;
  /**
   * Label for the send dialog's final confirm button, which dispatches
   * the message via {@link BlockKitchenProps.onSend}. Defaults to `'Send'`
   * (and shows `'Sending…'` while in flight regardless of this value).
   */
  confirmSendLabel?: string;
  /**
   * Branding tokens applied to the builder chrome (toolbar, palette,
   * popover editors, send dialog, JSON drawer, issues sheet). The
   * Slack preview itself is rendered by `slack-blocks-to-jsx` with its
   * native Slack styling regardless — use {@link BlockKitchenProps.defaultPreviewTheme}
   * for preview light/dark.
   *
   * Pass a preset name as sugar for `{ preset }`, or an object with
   * `tokens` (applied in both modes) and optional `light`/`dark`
   * overrides. The existing CSS-variable override path (importing the
   * stylesheet and setting `--primary`, etc. on your own selector)
   * continues to work; this prop is a typed shortcut on top of it.
   *
   * @example
   * ```tsx
   * <BlockKitchen
   *   theme={{
   *     tokens: { primary: '262 83% 58%', radius: '0.75rem' },
   *     dark: { primary: '263 70% 65%' }
   *   }}
   *   {...rest}
   * />
   * ```
   */
  theme?: BrandTheme | BrandPreset;
}
