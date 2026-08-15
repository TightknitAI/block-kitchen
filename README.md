<p align="center">
  <img src="./assets/logo.png" alt="block-kitchen logo" width="160" height="160" />
</p>

# block-kitchen

[![CI](https://github.com/TightknitAI/block-kitchen/actions/workflows/ci.yml/badge.svg)](https://github.com/TightknitAI/block-kitchen/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@tightknitai/block-kitchen.svg)](https://www.npmjs.com/package/@tightknitai/block-kitchen)
[![minzipped size](https://img.shields.io/bundlephobia/minzip/@tightknitai/block-kitchen)](https://bundlephobia.com/package/@tightknitai/block-kitchen)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Live demo](https://img.shields.io/badge/demo-live-6366f1)](https://block-kitchen.tightknit.dev)

A drag-and-drop, no-code-friendly visual builder for Slack Block Kit messages, packaged as an **integration-agnostic React component**.

Inspired by [Slack's Block Kit Builder](https://app.slack.com/block-kit-builder), reimagined as an embeddable React component you can drop into your own app.

**[Try the live demo →](https://block-kitchen.tightknit.dev)** (mocked Slack — drag, drop, edit, preview)

<p align="center">
  <img src="./assets/screenshot.png" alt="block-kitchen demo screenshot" width="900" />
</p>

The package owns the entire builder UX — palette, sortable preview surface, per-block popover editors, send dialog. It knows nothing about how channels are listed, who the user is, or how messages are sent. The consumer wires those concerns through callback props. A working end-to-end app is shown in [block-kitchen-template](https://github.com/TightknitAI/block-kitchen-template).

## Install

```bash
pnpm add @tightknitai/block-kitchen
```

Modern package managers (pnpm 8+, npm 7+, yarn berry) auto-install peer
dependencies — no extra command needed. The peer set is deliberately
narrow: only the dependencies a typical consumer is likely to *already*
have, where deduplication gives them a real win:

- `react` `^18 || ^19`, `react-dom` `^18 || ^19`
- `@radix-ui/react-{dialog,label,popover,radio-group,slot,tooltip}` —
  the dialog/popover/tooltip/sheet primitives the builder uses. If
  you already use shadcn/ui you already have these, and peer
  deduplication avoids two Radix copies (which would split React
  context — a `<TooltipProvider>` from your copy can't reach a
  `<Tooltip>` from ours).
- `lucide-react` — every icon in the toolbar, palette, and editors.
  Universal in modern React UI stacks; peer keeps a single copy.

Everything else (`@dnd-kit/*`, `@tiptap/*`, `slack-blocks-to-jsx`,
`@tightknitai/slack-block-kit-validator`) is a regular dependency.
Most consumers don't already have these, so there's no dedupe benefit
to forcing them into a peer position — and you don't have to think
about their versions.

If your package manager doesn't auto-install peers:

```bash
pnpm add @tightknitai/block-kitchen \
  react react-dom \
  @radix-ui/react-dialog @radix-ui/react-label \
  @radix-ui/react-popover @radix-ui/react-radio-group \
  @radix-ui/react-slot @radix-ui/react-tooltip \
  lucide-react
```

## Usage

> **Import the stylesheet once, at app root.** The builder mounts
> dialogs, popovers, tooltips, and the mobile palette sheet via React
> portals, which render to `document.body` — outside the route tree.
> If you import `styles.css` inside a single route module, those
> portal contents will be unstyled on every other route that doesn't
> import it. Put the import in your root layout (Next.js `app/layout.tsx`,
> Remix `app/root.tsx`, Vite `src/main.tsx`, etc.).

```tsx
import { BlockKitchen } from "@tightknitai/block-kitchen";
import "@tightknitai/block-kitchen/styles.css";

export function MyBuilderPage() {
  return (
    <BlockKitchen
      workspaceName="Acme Inc."
      loadChannels={async () => {
        const res = await fetch("/api/slack/channels");
        return res.json();
      }}
      loadSendAsUserStatus={async () => {
        const res = await fetch("/api/slack/me/can-send-as-user");
        return res.json();
      }}
      onSend={async ({ channelId, blocks, sendAsUser }) => {
        const res = await fetch("/api/slack/messages/send", {
          method: "POST",
          body: JSON.stringify({ channelId, blocks, sendAsUser }),
        });
        return res.json();
      }}
    />
  );
}
```

### Sizing

The builder is an app shell: a fixed toolbar over a palette rail and a preview pane that scroll independently. It fills its container, so the height you give that container is the height it takes.

```tsx
// Give it a definite height and it fills exactly that.
<div style={{ height: "100%" }}>
  <BlockKitchen {...props} />
</div>
```

Given no height to work with — a plain `<div>` in ordinary document flow — it bounds itself to `100svh` rather than growing to fit the palette's full block list, which would run a couple of thousand pixels down the page. Override that bound with `--bk-max-height` on any ancestor:

```css
/* Room for a 4rem page header above the builder. */
.builder-host { --bk-max-height: calc(100svh - 4rem); }

/* Or opt out entirely and let it grow with its content. */
.builder-host { --bk-max-height: none; }
```

## Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `workspaceName` | `string` | no | Shown in the preview chrome to mimic a real Slack message header. |
| `initialBlocks` | `SupportedBlock[]` | no | Starting draft. If omitted, the builder starts empty. |
| `onChange` | `(blocks: SupportedBlock[]) => void` | no | Fires on every state change. Use this to persist the draft (URL, localStorage, etc). |
| `onValidationChange` | `(summary: ValidationSummary) => void` | no | Fires when the draft's validation verdict changes (debounced alongside the builder's own validation pass — not on every keystroke). `summary` is `{ valid, errorCount, errors }`: the exact verdict the issues chip/sheet shows, always scoped to the `message` surface. Lets a host-owned CTA gate on validity in [compose-only mode](#compose-only-mode-bring-your-own-send-flow) without re-running the validator. |
| `loadChannels` | `() => Promise<{ id: string; name: string }[]>` | grouped\* | Returns channels available to send to. The package never makes Slack API calls itself. |
| `loadSendAsUserStatus` | `() => Promise<{ canSendAsUser: boolean; oauthUrl?: string }>` | grouped\* | Whether the current user has a Slack user-token and can post as themselves. If `canSendAsUser` is false, `oauthUrl` is shown as a "Sign in with Slack" link. |
| `onSend` | `(payload) => Promise<{ ok: boolean; error?: string }>` | grouped\* | Called when the user submits the send dialog. Payload is `{ channelId, blocks, sendAsUser, extras? }` (`extras` only when `renderSendExtras` is wired). |
| `renderSendExtras` | `(ctx: SendExtrasContext) => ReactNode` | no | Renders host-defined fields inside the built-in send dialog, below the channel and identity pickers. Collect values with `ctx.setExtras(patch)`; they arrive on `onSend` as `payload.extras`. Requires the send trio. See [Extending the send dialog](#extending-the-send-dialog-custom-fields). |
| `primaryAction` | `{ label, onClick, disableWhenInvalid? }` | no | Compose-only mode only: a host-owned button in the toolbar slot where "Review & send" normally sits. `onClick` receives `{ blocks, validation, loadedMessage }` — the current draft, the same verdict `onValidationChange` reports, and the currently [loaded message](#loading-an-existing-message-opt-in) (`null` unless `loading` is configured and one is loaded). See [Keeping the CTA in the toolbar](#keeping-the-cta-in-the-toolbar-primaryaction). |
| `loading` | `{ onLoadMessage, loadRecentMessages?, loadChannels?, initialTarget?, onLoadedMessageChange? }` | no | Opt-in: [load an existing message](#loading-an-existing-message-opt-in) into the editor. Adds a "Find message" toolbar entry — the user pastes a Slack permalink (or picks a recent message) and the draft is hydrated with its blocks. Loading is a *composition* concern, so it works in **both** send mode and compose-only mode. `onLoadedMessageChange` reports the loaded target (`null` on exit) so a host-owned commitment step can stay in sync. |
| `onUpdate` | `(payload) => Promise<{ ok: boolean; error?: string }>` | no | Opt-in update-in-place mode (send mode only); sibling to `onSend`, but the payload carries the source `channel + ts`. With `loading` configured, a loaded message flips the primary action to a "Review & update" split button wired to it (`chat.update`). |
| `loadButtonLabel` | `string` | no | Label + accessible name for the toolbar button that opens the load-message dialog. Defaults to `'Find message'`. Only shown when `loading` is configured. |
| `updateButtonLabel` | `string` | no | Label for the toolbar's primary button while a message is loaded for editing. It's a split button: clicking it updates the message in place; the menu beside it also offers "Send as a new message" (post the current blocks as new). Defaults to `'Review & update'`. |
| `confirmUpdateLabel` | `string` | no | Label for the update dialog's final confirm button. Defaults to `'Update message'` (shows `'Updating…'` while in flight). |
| `previewHooks` | `PreviewHooks` | no | Hooks forwarded to `slack-blocks-to-jsx`'s `<Message>` for resolving user / channel / emoji directives. |
| `customEmojis` | `CustomEmoji[]` | no | Workspace custom emoji (`{ name, url, alias }`) the preview resolves. Entries with a `url` render `:name:` as the workspace image; alias entries (`url: null`) fall back to their target emoji. Render-only — never serialized into the emitted Block Kit JSON. A caller-supplied `previewHooks.emoji` takes precedence. |
| `palette` | `PaletteSection[]` | no | The left-hand palette of draggable variants. Defaults to `defaultPalette`. Spread it to filter, reorder, or add your own pre-configured variants — see [Customizing the palette](#customizing-the-palette). |
| `disabledBlockTypes` | `SupportedBlockType[]` | no | Block types to hide from the palette without rebuilding it. Filters at the variant level — a section keeps any variants whose block types aren't disabled; sections that end up empty are dropped. Convenient when you want the default palette minus a few types (e.g. `['image', 'table']` for a text-only builder). |
| `paletteMode` | `'advanced' \| 'simple'` | no | How much of the palette the user meets first. `'advanced'` (default) renders the full sectioned palette with its search input. `'simple'` opens on a flat list of the variants flagged `basic` — in the built-in palette, just **Rich Text Section** — with no search and an "Advanced" link at the top that swaps in the full palette. Nothing is removed; it's a smaller first screen. See [Simple vs advanced palette](#simple-vs-advanced-palette). |
| `defaultOpenSections` | `boolean \| string[]` | no | Which palette section headers are expanded on first paint. `true` (default) opens all sections; `false` collapses all (Slack-style); an array opens only sections whose `name` is in the list (e.g. `['Section', 'Actions']`). The palette also has a built-in search input that expands matching sections on demand. |
| `showPaletteSearch` | `boolean` | no | Whether the palette renders the quick-search input above the section list. Defaults to `true`. Set `false` for compact palettes (e.g. when you've passed a small custom `palette`) where scanning by eye is faster than typing. Simple mode has no search either way — it appears with the rest of the palette behind "Advanced". |
| `paletteSearchPlaceholder` | `string` | no | Placeholder text for the palette search input. Defaults to `'Search blocks…'`. Useful for localization. |
| `allowedSurfaces` | `PreviewSurface[]` | no | Allowlist of preview surfaces (`'message'`, `'modal'`, `'app_home'`). Defaults to `['message']` — surface dropdown is hidden when only one surface is allowed. The first entry is the initial selection. |
| `showThemeControl` | `boolean` | no | Defaults to `true`. When `false`, the toolbar's light/dark toggle is hidden and the theme stays at `defaultPreviewTheme`. Ignored when `previewTheme` is set (a controlled theme always hides the toggle). |
| `defaultPreviewTheme` | `'light' \| 'dark'` | no | Initial (uncontrolled) preview theme. Pass the host app's current theme so the preview opens matched to the consuming app's appearance. Ignored when `previewTheme` is provided. |
| `previewTheme` | `'light' \| 'dark'` | no | Controlled preview theme. When set, the preview renders in this theme, follows it reactively, and the toolbar's light/dark toggle is hidden so the host app fully owns the theme. Leave unset to keep the preview uncontrolled (seeded from `defaultPreviewTheme`, toggle shown). |
| `sendButtonLabel` | `string` | no | Label and accessible name for the toolbar's Send button (which opens the send dialog). Defaults to `'Review & send'` (the dialog is the review step). Override it for product-specific copy, e.g. `'Send to channel…'`. |
| `confirmSendLabel` | `string` | no | Label for the send dialog's final confirm button. Defaults to `'Send'` (shows `'Sending…'` while in flight). |
| `theme` | `BrandTheme \| BrandPreset` | no | Branding tokens applied to the builder chrome (toolbar, palette, popovers, dialogs). Accepts a `Partial<BrandTokens>` map and optional `light`/`dark` overrides. See [Styling](#styling) below. |

\* The send trio — `loadChannels`, `loadSendAsUserStatus`, `onSend` — is
all-or-nothing: provide all three for the built-in send flow, or omit all
three for [compose-only mode](#compose-only-mode-bring-your-own-send-flow)
(no send button; your app owns the send flow). Wiring only some of the three
is a type error. `onUpdate` and `renderSendExtras` require the trio;
`primaryAction` requires its absence (the built-in Send/Update flow owns the
toolbar's primary slot otherwise). `loading` is mode-agnostic — it works
with or without the trio.

## Compose-only mode (bring your own send flow)

Omit the send trio entirely and the builder renders no send button — it
becomes a pure Block Kit editor. This is the right shape when composing is
one step in a flow your app owns (a wizard, an audience picker, a scheduler):
the package owns *composition* (authoring, preview, validation UX) and your
app owns *distribution* (audiences, identity, scheduling, delivery). The
only thing that crosses the boundary is the blocks array.

Mirror the draft with `onChange`, gate your own CTA with
`onValidationChange`, and hand `toSlackBlocks(draft)` to whatever comes next:

```tsx
import { useState } from "react";
import {
  BlockKitchen,
  toSlackBlocks,
  type SupportedBlock,
  type ValidationSummary,
} from "@tightknitai/block-kitchen";

function ComposeStep({ onNext }: { onNext: (blocks: SupportedBlock[]) => void }) {
  const [draft, setDraft] = useState<SupportedBlock[]>([]);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);

  return (
    <>
      <BlockKitchen onChange={setDraft} onValidationChange={setValidation} />
      {/* Your CTA, your copy, your placement — gated on the builder's own verdict. */}
      <button
        disabled={draft.length === 0 || validation?.valid === false}
        onClick={() => onNext(toSlackBlocks(draft))}
      >
        Next: choose audience
      </button>
    </>
  );
}
```

Notes:

- The rest of the toolbar (Clear, View JSON, the issues chip, theme/surface
  controls) is unchanged — users can still inspect problems in the issues
  sheet; only the moment of commitment moves into your app.
- `onValidationChange` reports the same verdict the issues sheet displays
  (validated against the `message` surface, like Send), so your CTA and the
  in-builder issue count can never disagree.
- [Loading an existing message](#loading-an-existing-message-opt-in) works
  here too — pass `loading` and the "Find message" entry appears. The loaded
  target (channel + ts + editability verdict) reaches your app via
  `primaryAction`'s `loadedMessage` context and
  `loading.onLoadedMessageChange`, so your own commitment step can offer
  "update in place" alongside "post as new".
- The built-in *update* flow (`onUpdate`) is unavailable in compose-only
  mode: dispatching a `chat.update` is inherently bound to a channel +
  timestamp + token, so it only exists alongside the send integration.

### Keeping the CTA in the toolbar (`primaryAction`)

The example above renders its CTA outside the builder. If you want the button
to sit where "Review & send" normally sits — say a message drafter whose
primary action is "Save template" — pass `primaryAction`:

```tsx
<BlockKitchen
  primaryAction={{
    label: "Save template",
    onClick: ({ blocks, validation }) => openSaveModal(blocks, validation),
    // Send-style gating is opt-in. Default is enabled-while-invalid: a
    // drafter usually allows committing a work-in-progress draft and
    // surfaces the verdict in its own flow instead.
    disableWhenInvalid: false,
  }}
/>
```

`onClick` receives the current draft in the builder's native format (the same
shape `onChange` reports — persist that to re-open the draft later; run it
through `toSlackBlocks` for the Slack-ready payload) plus the validation
verdict `onValidationChange` would report. The button is never disabled for
an empty draft; gate on `blocks.length` in `onClick` if you need that.

### Building a bespoke send flow from the exported primitives

If your custom flow ends in something send-shaped, you don't have to rebuild
the built-in dialog's machinery — the send-flow primitives are exported:

- `SendDialog` — the built-in dialog as a standalone component
  (`SendDialogProps`): channel loading/error states, bot-vs-user identity
  picker, OAuth hand-off, in-flight and failure states. Mount it against your
  own trigger.
- `useSlackSignIn(loadStatus, { open, enabled })` — the OAuth sign-in state
  machine behind the identity picker: fetches user-token status on open,
  refreshes on window focus, and background-polls after the OAuth tab opens
  until the token appears.
- `SlackSignInButton` — the "Sign in with Slack" button with its polling
  spinner, for wiring `useSlackSignIn` into your own dialog.

## Extending the send dialog (custom fields)

When the built-in send flow is *almost* right — you want the channel picker,
identity picker, and sending states, plus a few controls of your own (a
cross-post toggle, a custom sender name) — pass `renderSendExtras` instead of
rebuilding the dialog. It renders below the built-in fields, and whatever you
collect via `setExtras` arrives on `onSend` as `payload.extras`:

```tsx
<BlockKitchen
  loadChannels={loadChannels}
  loadSendAsUserStatus={loadSendAsUserStatus}
  renderSendExtras={({ extras, setExtras }) => (
    <>
      <label>
        <input
          type="checkbox"
          checked={Boolean(extras.alsoPostToIntranet)}
          onChange={(e) => setExtras({ alsoPostToIntranet: e.target.checked })}
        />
        Also publish to the intranet
      </label>
      <label>
        Custom sender name
        <input
          type="text"
          value={String(extras.senderName ?? "")}
          onChange={(e) => setExtras({ senderName: e.target.value })}
        />
      </label>
    </>
  )}
  onSend={async ({ channelId, blocks, sendAsUser, extras }) => {
    await api.send({ channelId, blocks, sendAsUser, ...extras }); // your code
    return { ok: true };
  }}
/>
```

Notes:

- The `extras` object is owned by the dialog: it resets every time the dialog
  opens (alongside the channel and identity pickers), and `setExtras(patch)`
  shallow-merges. Render controlled inputs from `extras`.
- The context also carries the currently selected `channelId` (`null` until
  channels load) and `sendAsUser`, so extras can react to them — e.g. only
  offer cross-posting for certain channels.
- `payload.extras` is present iff `renderSendExtras` is wired, so existing
  `onSend` handlers never see a new key.
- The dialog renders in a portal attached to `document.body`, so CSS that
  relies on ancestor selectors from your app's DOM won't reach slot content —
  style it directly (inline, CSS modules, utility classes).
- For customizations that generalize something the dialog already models
  (identities, channels), prefer proposing a first-class prop over routing
  them through extras; the slot is for genuinely host-specific concerns.

## Loading an existing message (opt-in)

By default the builder starts from a blank canvas. Pass `loading` to let
users load an already-posted message's blocks into the editor — paste a
permalink, or pick from a "recent messages from this app" list. Loading is a
*composition* concern, so it works in **both** send mode and
[compose-only mode](#compose-only-mode-bring-your-own-send-flow). The
package stays integration-agnostic: it makes no Slack calls and computes
nothing about who can edit; the host does both.

The **Find an existing message** dialog is two panes on wide viewports
(stacked on narrow ones): on the left, a **Pick from Recent** tab (channel
picker + recent messages) and a **Direct Link** tab (paste a permalink); on
the right, a live Slack-style preview of whichever message is selected,
rendered by the same preview pipeline as the builder — so users see the
message before committing to it. The tab strip only appears when the recent
picker is configured; otherwise the link pane stands alone. Pasted links are
debounced before `onLoadMessage` runs, so typing never fires a lookup per
keystroke.

```tsx
<BlockKitchen
  /* …send trio, or nothing (compose-only)… */
  loading={{
    // Host parses the pasted permalink, fetches the message, and returns a
    // verdict. `chat.update` only edits a message authored by the calling
    // token, so the host decides: bot message → 'bot', the user's own
    // message → 'user', anything else → not editable.
    onLoadMessage: async ({ link }) => {
      const msg = await fetchMessageFromPermalink(link); // your code
      if (!msg) return { ok: false, reason: "Couldn't find that message." };
      if (!msg.blocks?.length) return { ok: false, reason: 'This message has no editable blocks.' };
      // `username` + `iconUrl` are optional; when present they show in the
      // preview header instead of the generic workspace name/avatar.
      const author = { username: msg.authorName, iconUrl: msg.authorAvatarUrl };
      if (msg.appId === MY_APP_ID)
        return { ok: true, channelId: msg.channel, channelName: msg.channelName, ts: msg.ts, blocks: msg.blocks, editableVia: 'bot', ...author };
      if (msg.userId === currentUserId)
        return { ok: true, channelId: msg.channel, channelName: msg.channelName, ts: msg.ts, blocks: msg.blocks, editableVia: 'user', ...author };
      return { ok: false, reason: 'Only messages your app or you posted can be edited.', blocks: msg.blocks };
    },
    // Optional: adds the "Pick from Recent" tab beside "Direct Link". The user
    // first picks a channel, then this is called with that `channelId` so the
    // lookup scans only one channel. These are editable-by-construction (the
    // app authored them), so selecting one previews it and loads it directly
    // (no verdict needed).
    loadRecentMessages: async (channelId) => {
      const msgs = await fetchRecentAppMessages(channelId); // your code
      return msgs.map((m) => ({
        channelId: m.channel,
        channelName: m.channelName,
        ts: m.ts,
        blocks: m.blocks,
        editableVia: 'bot', // defaults to 'bot' if omitted
        label: m.preview // one-line preview shown in the picker row
      }));
    }
    // In send mode the recent picker's channel list reuses the send trio's
    // `loadChannels`. In compose-only mode there is no trio — pass
    // `loadChannels` here too, or the picker is hidden.
  }}
/>
```

- On `ok`, the builder hydrates with `blocks` and shows a loaded banner
  ("References an existing message in #channel"), with the author's
  name/avatar in the preview header.
- On `{ ok: false, reason }`, the dialog's preview pane renders the reason and
  offers **Open as a new message instead**. Pass `blocks` on the failure
  result to hydrate the draft for that fallback — they're previewed under the
  reason too.
- On `{ ok: false, oauthUrl }`, the preview pane shows a **Sign in with Slack**
  button that opens the URL and re-checks the load once sign-in completes.
- `loading.onLoadedMessageChange` reports the loaded target — and `null`
  when the user exits it — so host state stays in sync (most useful in
  compose-only mode, where your app owns what happens next). It can
  **re-fire for the same `channelId` + `ts`** when the host's verdict or
  metadata changed (e.g. `editableVia` flipping after a Slack sign-in), so
  key host state on the full target, not `ts` alone.
- The banner's **"Switch to a new message"** exit is mode-aware: in send
  mode it clears the canvas and reopens the load dialog (the edit-centric
  "pick a different message" flow); in compose-only mode it only detaches
  the reference and **keeps the draft** — loading seeded a composition, and
  a misclick must not destroy it.

### Updating it in place (send mode)

In send mode, pair `loading` with `onUpdate` to dispatch a `chat.update` for
the loaded message. The primary action flips to a "Review & update" split
button (the menu also offers "Send as a new message"), the destination is
locked to the source channel, and the post-as identity is fixed to the
verdict's `editableVia` (the `'user'` path reuses `loadSendAsUserStatus` for
the "Sign in with Slack" gate).

```tsx
<BlockKitchen
  /* …send trio… */
  loading={{ onLoadMessage }}
  // Sibling to onSend; carries the source channel + ts. `asUser` follows
  // the verdict's `editableVia`.
  onUpdate={async ({ channelId, ts, blocks, asUser }) => {
    await chatUpdate({ channel: channelId, ts, blocks, asUser }); // your code
    return { ok: true };
  }}
/>
```

With `loading` alone (no `onUpdate`), a loaded message can still be posted
as a brand-new message via the regular Send flow — there's just no in-place
update. In compose-only mode `onUpdate` doesn't exist; implement your own
update against the target from `loadedMessage` / `onLoadedMessageChange`.

> **Migrating from the pre-split `editing` bundle (≤ 0.9.x):** the load
> fields move to `loading` unchanged, and `onUpdate` becomes a top-level
> prop (the `editing` wrapper is gone).
>
> ```tsx
> // Before
> <BlockKitchen editing={{ onLoadMessage, onUpdate, loadRecentMessages }} />
> // After
> <BlockKitchen loading={{ onLoadMessage, loadRecentMessages }} onUpdate={onUpdate} />
> ```

## Customizing the palette

The default palette ships with curated presets for every supported block type. To narrow what's available, or add your own pre-configured variants (e.g. a "Help footer" section), pass a `palette` array. Define it at module scope (or wrap in `useMemo`) so it stays referentially stable across renders.

```tsx
import {
  BlockKitchen,
  defaultPalette,
  type PaletteSection,
} from "@tightknitai/block-kitchen";

const PALETTE: readonly PaletteSection[] = [
  ...defaultPalette.filter((s) => s.blockType !== "input"),
  {
    name: "Company presets",
    blockType: "section",
    variants: [
      {
        id: "help_footer",
        label: "help footer",
        factory: () => ({
          type: "section",
          text: { type: "mrkdwn", text: "Need help? Reach out in <#C0HELP>." },
        }),
      },
    ],
  },
];

<BlockKitchen palette={PALETTE} {...rest} />;
```

Variant `id`s must be unique across the array — the drag-drop lookup keys by id.

### Simple vs advanced palette

By default the palette opens on everything it has: every section, plus the search input. For consumers whose users are writing ordinary messages rather than building interactive apps, `paletteMode="simple"` opens on a one-block starter list instead — no sections, no search — behind an **Advanced** link that swaps in the full palette (and back).

```tsx
<BlockKitchen paletteMode="simple" {...rest} />
```

Which variants the simple list holds is a property of the palette, not the flag: a variant opts in with `basic: true`. The built-in palette flags exactly one — **Rich Text Section** — so a custom palette that wants its own starter block says so:

```tsx
const PALETTE: readonly PaletteSection[] = [
  {
    name: "Company presets",
    icon: AlignLeft,
    variants: [
      { id: "help_footer", label: "Help footer", basic: true, factory: () => ({ ... }) },
      { id: "company_divider", label: "Company divider", factory: () => ({ ... }) },
    ],
  },
];
```

A palette that flags none of its variants `basic` has no simple list to show, so it renders as `'advanced'` regardless — the link is withheld rather than leading to an empty rail.

## Templates (`TemplatePicker`)

`TemplatePicker` is a standalone, page-sized picker that renders `Template`s as a grid of cards with live block previews, grouped into category sections — modeled on Slack's own Block Kit Builder templates page. It's pure UI: it owns no dialog and no layout, so you decide whether it's a route, a modal, a slide-over, or a sidebar next to the builder.

```tsx
import {
  BlockKitchen,
  TemplatePicker,
  type SupportedBlock,
  type Template,
} from "@tightknitai/block-kitchen";
import { useState } from "react";

const TEMPLATES: Template[] = [
  {
    id: "standup",
    name: "Daily standup",
    description: "Yesterday / today / blockers",
    surface: "message",
    category: "Team", // optional — groups cards into sections
    blocks: [
      /* SupportedBlock[] */
    ],
  },
];

function Builder() {
  const [blocks, setBlocks] = useState<SupportedBlock[]>([]);
  // `initialBlocks` is read once at mount, so bump a key to re-seed.
  const [seedKey, setSeedKey] = useState(0);

  return (
    <div style={{ display: "flex", minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <BlockKitchen key={seedKey} initialBlocks={blocks} onChange={setBlocks} {...rest} />
      </div>
      {/* `.bk-root` is required — see below */}
      <aside className="bk-root" style={{ width: 380, overflowY: "auto" }}>
        <TemplatePicker
          templates={TEMPLATES}
          heading="Templates"
          onSelect={(t) => {
            setBlocks(t.blocks);
            setSeedKey((n) => n + 1);
          }}
        />
      </aside>
    </div>
  );
}
```

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `templates` | `Template[]` | yes | Templates to show. Order is preserved within each category section. |
| `onSelect` | `(template: Template) => void` | yes | Called with the whole template when a card is clicked. Nothing is applied to the builder for you — see [Applying a selection](#applying-a-selection). |
| `surface` | `'message' \| 'modal' \| 'app_home'` | no | Filter to templates whose `surface` matches. Omit to show all. |
| `theme` | `'light' \| 'dark'` | no | Preview theme used inside the card thumbnails. Defaults to `'light'`; pass the builder's `previewTheme` to keep them in step. |
| `heading` | `string` | no | Heading rendered above the grid. Omitted means no heading. |
| `emptyLabel` | `string` | no | Shown when the `surface` filter matches nothing. Defaults to `'No templates available.'`. |
| `className` | `string` | no | Merged onto the root element. |

A `Template` is `{ id, name, surface, blocks }` plus optional `description` and `category`. Templates without a `category` fall into a trailing **Other** section when at least one other template has one; with no categories at all, the grid renders flat without section headers.

### Bring your own templates

The package ships **no** templates on purpose — they're use-case examples ("Expense approval" belongs to an approvals product, "Daily standup" to a team product), so they belong in your app's config rather than the library bundle. The live demo defines its own set in [`demo/src/templates.ts`](demo/src/templates.ts) if you want a starting point to crib from.

### Applying a selection

`onSelect` hands you the template and stops there — the picker never reaches into the builder. Because [`initialBlocks`](#props) is read once at mount, replacing the current draft means re-seeding with a changed `key`, as above. Selecting a template this way discards the draft and its undo history, so gate it behind a confirmation if that's a surprise in your app.

### It needs a `.bk-root` ancestor

Unlike `BlockKitchen`, the picker does not add the `bk-root` class itself. The stylesheet ships its utilities inside `@scope (.bk-root, .bk-portal-content)`, so a picker mounted outside both roots renders unstyled. Wrap it (or any ancestor) in `className="bk-root"`.

## Boundary

The package is deliberately decoupled from any Slack SDK or backend. It does not import HTTP clients, OAuth libraries, or workspace-state systems. Everything I/O-shaped is brokered through props — and the send flow itself is optional: see [compose-only mode](#compose-only-mode-bring-your-own-send-flow) when your app owns the moment of commitment.

Helpers and send-flow primitives also exported:

```ts
import {
  toSlackBlocks,           // scrubs unsafe URLs + retrieval-only fields before sending
  encodeBlocksToString,    // base64url-encode a blocks array (for URL state)
  decodeBlocksFromString,
  defaultPalette,          // the built-in palette — spread to customize
  SendDialog,              // the built-in send dialog, standalone (bespoke send flows)
  TemplatePicker,          // the standalone templates grid — see Templates above
  useSlackSignIn,          // the OAuth sign-in state machine behind the identity picker
  SlackSignInButton,       // the "Sign in with Slack" button + polling spinner
} from "@tightknitai/block-kitchen";

import type {
  SupportedBlock,
  SupportedBlockType,
  BlockKitchenProps,
  BlockKitchenBaseProps,        // shared props
  BlockKitchenSendProps,        // the send trio + `onUpdate` + `renderSendExtras`
  LoadingConfig,                // load an existing message (works in both modes)
  LoadedMessage,                // the loaded target: channel + ts + verdict
  BlockKitchenComposeOnlyProps, // the trio explicitly absent + `primaryAction`
  PaletteSection,
  PaletteVariant,
  PaletteMode,                  // 'advanced' (default) | 'simple'
  SendPayload,
  SendResult,
  SendDialogProps,
  SendExtrasContext,
  PrimaryActionConfig,
  PrimaryActionContext,
  ChannelOption,
  SendAsUserStatus,
  Template,                     // one entry in a TemplatePicker gallery
  ValidationSummary,
  PreviewHooks,
} from "@tightknitai/block-kitchen";
```

## Backend

The builder is frontend-only. For a full app that handles OAuth, channel listing, and `chat.postMessage`, see [block-kitchen-template](https://github.com/TightknitAI/block-kitchen-template) — a Vite + React SPA on Cloudflare Workers that wires this package to [slack-hono](https://github.com/TightknitAI/slack-hono) on the backend.

## Emoji

A searchable emoji picker (search, categories, skin tone, recents) is built into the rich-text WYSIWYG and structured editors and the section / header / markdown / button-label fields. The standard set is sourced from [`emoji-datasource`](https://www.npmjs.com/package/emoji-datasource) — the same iamcal codenames Slack recognizes — and resolved by Unicode codepoint, so inserted emoji round-trip to Slack without becoming blank `:name:` text. Skin-toned emoji emit Slack's `skin_tone` (rich text) / `:name::skin-tone-N:` (plain/mrkdwn) shape. The dataset is loaded lazily the first time a picker opens, so it doesn't add to the initial bundle.

Pass [`customEmojis`](#props) to add your workspace's custom emoji: image entries appear as the picker's **Custom** category and render in the preview; alias entries fall back to their target. Custom emoji never block Send — Slack accepts unknown emoji names, so they're excluded from validation. The emitted Block Kit JSON is unchanged whether or not `customEmojis` is passed.

## Validation

Defense-in-depth: blocks are validated against [slack-block-kit-validator](https://github.com/TightknitAI/slack-block-kit-validator) before send. Issues are surfaced in the issues sheet with line numbers — users can fix them inline before posting.

## Undo & redo

Every edit to the draft is undoable — adding, deleting, duplicating,
reordering, dragging in and out of containers, editing a block's fields, and
the toolbar's **Clear** and **View JSON → apply**. The toolbar shows **Undo**
and **Redo** buttons (disabled when there's nothing to step to), and the
keyboard shortcuts work whenever focus is inside the builder:

| Shortcut | Action |
|---|---|
| `Ctrl`/`Cmd` + `Z` | Undo |
| `Ctrl`/`Cmd` + `Shift` + `Z`, or `Ctrl` + `Y` | Redo |

Notes:

- **Typing coalesces.** A run of edits to the *same* field collapses into a
  single undo step, so one `Ctrl+Z` rewinds the whole edit rather than one
  character at a time. Editing a different block, or any structural change,
  starts a new step.
- **Native text undo is preserved.** While a text input, textarea, or the
  inline rich-text editor is focused, `Ctrl/Cmd+Z` performs the browser's
  own per-character undo — the builder only takes over when focus is on the
  canvas or toolbar. The shortcut is scoped to the builder, so it never
  hijacks the host app's own `Ctrl/Cmd+Z`.
- **Loading is a fresh baseline.** [Loading an existing
  message](#loading-an-existing-message-opt-in) (or "open as new") starts a
  new document with an empty history — undo won't step back across the load
  into the previous draft. **Clear**, by contrast, is undoable.
- Undo and redo are ordinary draft changes, so they flow through `onChange`
  (and re-run validation) like any other edit.

## Styling

Ships a compiled stylesheet at `@tightknitai/block-kitchen/styles.css`. The styles use CSS custom properties (`--background`, `--primary`, `--border`, etc.) for theming. Consumers must provide values for these vars — the standard shadcn/ui token set works as-is.

```ts
import "@tightknitai/block-kitchen/styles.css";
```

### Branding (typed `theme` prop)

For consumers who don't already have a shadcn token set on `:root`, the `theme` prop is a typed shortcut that writes a subset of tokens directly:

```tsx
import type { BrandTheme } from "@tightknitai/block-kitchen";

const brand: BrandTheme = {
  tokens: { primary: "262 83% 58%", radius: "0.75rem" },
  dark:   { primary: "263 70% 75%" }
};

<BlockKitchen theme={brand} {...rest} />
```

- `tokens` applies in both light and dark contexts.
- `light` and `dark` override per mode; the dark variant kicks in under a standard `.dark` ancestor class (next-themes default).
- Color tokens take HSL component strings (`"262 83% 58%"`), matching the underlying CSS variable contract; `radius` takes a CSS length.
- Scope is the builder chrome only. The embedded Slack preview keeps its native Slack styling regardless of `theme`; use `previewTheme` (controlled) or `defaultPreviewTheme` (uncontrolled) for the preview's light/dark appearance.

The lower-level CSS-variable contract above keeps working; the `theme` prop simply layers on top of it.

### Typography

Fonts are deliberately not part of `BrandTheme`. The builder sets no `font-family` of its own (aside from `font-mono` on the JSON viewer, which is intentional), so it inherits whatever the host page declares on `<html>` or `<body>`. Set your brand typography globally and the builder will pick it up automatically — no additional configuration needed. The Slack preview surface continues to render with Slack's own typography via `slack-blocks-to-jsx`.

## Frameworks & SSR

The builder is client-only by design — it uses drag sensors, contentEditable
(TipTap), portals, and `useEffect`-driven state. It cannot be statically
rendered on the server. The component still ships fine inside SSR/SSG
frameworks; just mark its tree as client-side.

- **Next.js (App Router)** — put `'use client'` at the top of the file
  that renders `<BlockKitchen>`. Import `styles.css` from
  `app/layout.tsx` (the root layout) so portal content stays styled
  on every route.
- **Next.js (Pages Router)** — render the component inside a page
  module; the bundled-client default works. Import `styles.css` from
  `pages/_app.tsx`.
- **Remix / React Router** — render inside any route component;
  put the `styles.css` import in `app/root.tsx`. If you ship the
  builder on a single route, import the stylesheet there *and*
  in `root.tsx` so portals on other routes don't render unstyled.
- **Vite SPA** — import `styles.css` once from `src/main.tsx`.
- **Astro** — load the React component with `client:only="react"`.

The package exports React JSX with the automatic runtime, so any
JSX-transform-aware bundler from the last few years works without
extra configuration.

## Subpath exports

Three import paths are published:

```ts
// 1. Full builder (default)
import { BlockKitchen } from "@tightknitai/block-kitchen";

// 2. Headless helpers — no React component tree, safe for backends.
//    Use this when you only need to round-trip / validate / encode
//    blocks (e.g. inside a Worker that calls Slack's chat.postMessage).
import {
  toSlackBlocks,
  encodeBlocksToString,
  decodeBlocksFromString,
} from "@tightknitai/block-kitchen/helpers";

// 3. Palette catalog — for tooling that needs the default variants
//    (e.g. a Storybook story or a config generator) without pulling
//    in the builder.
import {
  defaultPalette,
  legacyInputVariants,
  extraAlertVariant,
} from "@tightknitai/block-kitchen/palette";
```

The root entry (`.`) still re-exports everything from `./helpers` and
`./palette`, so existing imports keep working — the subpaths are a tree-
shaking-friendly shortcut, not a breaking split.

## Cascade layer ordering (Tailwind users)

The stylesheet emits all utility classes into a named cascade layer:

```css
@layer bk-theme, bk-utilities;
```

Per CSS Cascade Level 5, unlayered rules and rules in later-declared
layers win over `bk-utilities`. In practice this means a consumer who
imports both this package's `styles.css` and their own Tailwind output
will see *their* utilities win on any class-name collision (e.g. they
define `bg-background` differently). No action needed for that
common case.

If you want explicit control — for example, to make this package's
utilities win, or to layer them alongside a `shadcn/ui` token stack —
declare the order at the top of your own root stylesheet:

```css
@layer bk-theme, bk-utilities, theme, base, components, utilities;
```

## License

MIT. See [LICENSE](./LICENSE).

---

Maintained by the [Tightknit](https://tightknit.ai) team.
