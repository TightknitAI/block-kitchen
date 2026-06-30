# Changelog

## [0.9.1](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.9.0...block-kitchen-v0.9.1) (2026-06-30)


### Features

* **load-dialog:** keep Load button visible and always show a content preview ([e71d192](https://github.com/TightknitAI/block-kitchen/commit/e71d192a02512cec00c3f2bc0f9300d3004f0cd0))
* **load-dialog:** show pretty date with raw ts in parens for recent messages ([45c55c3](https://github.com/TightknitAI/block-kitchen/commit/45c55c388df9671fe022a6c797a4d957f4a9e563))
* reorder send-dialog inputs and switch Load button to mail-search icon ([3278291](https://github.com/TightknitAI/block-kitchen/commit/3278291255640cc31b78e87d6561fb9522d50571))
* **toolbar:** keep Load message button visible after a message is loaded ([de947a6](https://github.com/TightknitAI/block-kitchen/commit/de947a6cdb79c4a46908c4aa988ac7207b157e65))

## [0.9.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.11...block-kitchen-v0.9.0) (2026-06-30)


### ⚠ BREAKING CHANGES

* **editing:** `EditingConfig.loadRecentMessages` now takes a `channelId`

### Features

* **editing:** scope recent-messages picker to a chosen channel ([6ed0ad7](https://github.com/TightknitAI/block-kitchen/commit/6ed0ad7e65d282cce1ea2bef68685e0fa09c0812))

## [0.8.11](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.10...block-kitchen-v0.8.11) (2026-06-30)


### Features

* **editing:** opt-in message edit mode (load existing + update) ([2eac3cf](https://github.com/TightknitAI/block-kitchen/commit/2eac3cfe06b62b6048aa0cdd6a58118fc61e420e))
* **editing:** optional author username + icon for the loaded message ([d14c429](https://github.com/TightknitAI/block-kitchen/commit/d14c4294bb21cc2eb9b2ffab26eddb00e642ccba))
* **editing:** restore Load button; split update into update/send-as-new ([345c727](https://github.com/TightknitAI/block-kitchen/commit/345c72716f7a36465316b2652e3d31476e318301))
* **editing:** show a formatted date in the edit banner ([b0e1b5b](https://github.com/TightknitAI/block-kitchen/commit/b0e1b5b28d238f0e292ca75a63cd7ad768b0e483))
* **toolbar:** default the send button label to "Review & send" ([2e076ca](https://github.com/TightknitAI/block-kitchen/commit/2e076ca4309f49758a9ec701f2eb0f15715a94e5))


### Bug Fixes

* **toolbar:** align Docs link sizing with the other buttons ([f0f4367](https://github.com/TightknitAI/block-kitchen/commit/f0f4367a605b82b23cd90b230a4155175a50c504))

## [0.8.10](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.9...block-kitchen-v0.8.10) (2026-06-30)


### Bug Fixes

* **carousel:** full card editor per card + Home Tabs template icon URL ([e32874b](https://github.com/TightknitAI/block-kitchen/commit/e32874b4e8b9b68fb304868719094cd4ce42e15a))
* **carousel:** full card editor per card; fix Home Tabs template icon URL ([0825ef4](https://github.com/TightknitAI/block-kitchen/commit/0825ef4ac798ca7a88916b52bcd7737776b58a36))

## [0.8.9](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.8...block-kitchen-v0.8.9) (2026-06-29)


### Features

* **container:** drag blocks into and out of containers on the canvas ([2be9e6a](https://github.com/TightknitAI/block-kitchen/commit/2be9e6a65d528851a4572a07abd157ae8bee7383))
* **container:** drag blocks into and out of containers on the canvas ([f500dc5](https://github.com/TightknitAI/block-kitchen/commit/f500dc5d3ebffe31c40e60385d61a8aa8749fd25))


### Bug Fixes

* **container:** scope child toolbars to their own hover ([2bd06f0](https://github.com/TightknitAI/block-kitchen/commit/2bd06f0864baa59083f73db74370c2f8c06a432f))

## [0.8.8](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.7...block-kitchen-v0.8.8) (2026-06-29)


### Features

* add the new Slack container block ([bb6fe91](https://github.com/TightknitAI/block-kitchen/commit/bb6fe91342993261090458fb3137be7de1b622ed))
* add the new Slack container block ([d942e90](https://github.com/TightknitAI/block-kitchen/commit/d942e9063d1591aa49bf7cbf76e06d821f9554ed))

## [0.8.7](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.6...block-kitchen-v0.8.7) (2026-06-24)


### Features

* add data_visualization (chart) block support ([3b477af](https://github.com/TightknitAI/block-kitchen/commit/3b477afdff1ac1a08e4280544ab195062009909e))
* add underline text style support to rich text editor ([732583b](https://github.com/TightknitAI/block-kitchen/commit/732583b4a4e78bd5166e19d7bcb1ba20b7b2a58c))
* **rich-text:** support underline text style in rich_text blocks ([b9a5986](https://github.com/TightknitAI/block-kitchen/commit/b9a59860de9b29422e7105517b7305e5aa1c5da4))
* support the new Slack data visualization blocks ([1e85c06](https://github.com/TightknitAI/block-kitchen/commit/1e85c0663b713ecc4c09f30538895d299a62dd44))


### Bug Fixes

* pin slack-blocks-to-jsx to ^1.0.6 (1.0.7 does not exist) ([17708c5](https://github.com/TightknitAI/block-kitchen/commit/17708c5bfcd941fbb696918894151ba878cfb4e9))
* **test:** polyfill localStorage for Node 22 unit tests ([1f8d995](https://github.com/TightknitAI/block-kitchen/commit/1f8d995559dd7fa626a93465986bb3c293dd78ad))

## [0.8.6](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.5...block-kitchen-v0.8.6) (2026-06-12)


### Features

* host-controllable preview theme, configurable Send label, Slack JSON import, clearer error indicator ([1737fe1](https://github.com/TightknitAI/block-kitchen/commit/1737fe1a1a7d44d6737b77243607c640b9d1bc60))
* host-controllable preview theme, configurable Send label, Slack JSON import, clearer error indicator ([00c41f2](https://github.com/TightknitAI/block-kitchen/commit/00c41f25ff3ea80cb398345fb820d261d25207f3))

## [0.8.5](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.4...block-kitchen-v0.8.5) (2026-06-11)


### Bug Fixes

* **rich-text:** autolink, ordered-list input rule, and soft line breaks (ENG-4850) ([cf4d68a](https://github.com/TightknitAI/block-kitchen/commit/cf4d68ab4d737c47b25240455d3912fa1d68a99b))
* **rich-text:** autolink, ordered-list input rule, and soft line breaks (ENG-4850) ([17eb863](https://github.com/TightknitAI/block-kitchen/commit/17eb86319f60ecbe49734d630f74fa5fb624279f))

## [0.8.4](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.3...block-kitchen-v0.8.4) (2026-06-04)


### Features

* add emoji picker and rich-text emoji support ([89f0ac8](https://github.com/TightknitAI/block-kitchen/commit/89f0ac8ff4516f826d9f4bdced51dffa74dd272c))
* **emoji:** customEmojis prop, preview hook, non-blocking validation (ENG-4792 Phase 1) ([870c01d](https://github.com/TightknitAI/block-kitchen/commit/870c01d6290f32d1df8739725174d6bb2075aa52))
* **emoji:** emoji picker + WYSIWYG emoji node (ENG-4792 Phase 2) ([8dc1e65](https://github.com/TightknitAI/block-kitchen/commit/8dc1e65ad6f7d9dc077e50132f0d41e95d291e66))


### Bug Fixes

* **ci:** gate release-please publish on releases_created == 'true' ([5cd6066](https://github.com/TightknitAI/block-kitchen/commit/5cd60666c8c2be73f461675494a9025a817cd2f8))
* **ci:** gate release-please publish on releases_created == 'true' ([f0cf9c7](https://github.com/TightknitAI/block-kitchen/commit/f0cf9c73b4563b43078f9bf20ad427d552c11edf))
* collapse context-block validation error cascade ([#88](https://github.com/TightknitAI/block-kitchen/issues/88)) ([9f696c4](https://github.com/TightknitAI/block-kitchen/commit/9f696c4cd9845d28a0cbe569d49ce754e2b8c19d))
* **emoji:** clear stale unicode on structured-editor pick; copy-on-write validation sanitizer ([bf7e71d](https://github.com/TightknitAI/block-kitchen/commit/bf7e71d2957ef5a1e32501f204a7995087eaeaf6))

## [0.8.3](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.2...block-kitchen-v0.8.3) (2026-05-20)


### Features

* **task-card:** edit details and output rich-text fields in the UI ([de41c81](https://github.com/TightknitAI/block-kitchen/commit/de41c81cc1fae6e81fddeebc5e3afb81c93600f3))
* **task-card:** edit details and output rich-text fields in the UI ([bbe39ef](https://github.com/TightknitAI/block-kitchen/commit/bbe39ef72f3dde37e58b447e4d10bf3abee8c0e2))

## [0.8.2](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.1...block-kitchen-v0.8.2) (2026-05-20)


### Bug Fixes

* **ci:** publish via npm CLI for Trusted Publisher OIDC ([#76](https://github.com/TightknitAI/block-kitchen/issues/76)) ([aab5ec8](https://github.com/TightknitAI/block-kitchen/commit/aab5ec827125b3b7b2f86b2f8beb9ea885c0be46))
* **ci:** publish via npx and tag prereleases explicitly ([#78](https://github.com/TightknitAI/block-kitchen/issues/78)) ([7475c86](https://github.com/TightknitAI/block-kitchen/commit/7475c86cf7d51cbe702733ca353b3dc894243164))

## [0.8.1](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.8.0...block-kitchen-v0.8.1) (2026-05-20)


### Bug Fixes

* **ci:** publish on releases_created (manifest mode) ([#74](https://github.com/TightknitAI/block-kitchen/issues/74)) ([c29a2ce](https://github.com/TightknitAI/block-kitchen/commit/c29a2cef84fedcc26baa96c007e5c92276118760))

## [0.8.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.7.0...block-kitchen-v0.8.0) (2026-05-19)


### ⚠ BREAKING CHANGES

* prepare 0.7.0 release with peer-dep migration and consumer polish ([#70](https://github.com/TightknitAI/block-kitchen/issues/70))
* **palette:** consolidate variants to mirror Slack's Block Kit Builder ([#39](https://github.com/TightknitAI/block-kitchen/issues/39))
* rename package to @tightknitai/block-kitchen ([#30](https://github.com/TightknitAI/block-kitchen/issues/30))
* **palette:** consumer-defined palette via `palette` prop ([#26](https://github.com/TightknitAI/block-kitchen/issues/26))
* allowedBlockTypes + allowedSurfaces allowlists ([#17](https://github.com/TightknitAI/block-kitchen/issues/17))

### Features

* **a11y:** enforce axe in Storybook and fix violations ([#14](https://github.com/TightknitAI/block-kitchen/issues/14)) ([565b656](https://github.com/TightknitAI/block-kitchen/commit/565b656752e2f684a727b88cc8a59fbe0ea6968f))
* add `theme` prop for branding the builder chrome ([#29](https://github.com/TightknitAI/block-kitchen/issues/29)) ([957c7cd](https://github.com/TightknitAI/block-kitchen/commit/957c7cd25dcbe5c40ee6fd6b815069b8eb0a7deb))
* add standalone TemplatePicker component ([#34](https://github.com/TightknitAI/block-kitchen/issues/34)) ([ef63a69](https://github.com/TightknitAI/block-kitchen/commit/ef63a697de8073b5c135d0fb54b4edf679dd4a81))
* allowedBlockTypes + allowedSurfaces allowlists ([#17](https://github.com/TightknitAI/block-kitchen/issues/17)) ([a5185ad](https://github.com/TightknitAI/block-kitchen/commit/a5185adbf9ee6bc75400352c305f5c3f8d9bf367))
* **demo:** make templates panel resizable and auto-shrinking ([#54](https://github.com/TightknitAI/block-kitchen/issues/54)) ([8e28fe8](https://github.com/TightknitAI/block-kitchen/commit/8e28fe84717c44a18a055451007e7167bbfaaa59))
* **demo:** prepare for public hosting ([#45](https://github.com/TightknitAI/block-kitchen/issues/45)) ([a77cf11](https://github.com/TightknitAI/block-kitchen/commit/a77cf1167c34f33f6bec701913dd76f79195d361))
* **dnd:** show clear landing position while dragging a block ([#19](https://github.com/TightknitAI/block-kitchen/issues/19)) ([dd3554b](https://github.com/TightknitAI/block-kitchen/commit/dd3554bb11bc50c96d5048044cfecb64d334430f))
* **input:** show per-element hint in empty Placeholder field ([#67](https://github.com/TightknitAI/block-kitchen/issues/67)) ([4ee73ad](https://github.com/TightknitAI/block-kitchen/commit/4ee73adcc74875f5fe5a2447e774b04538d92f90))
* **mobile:** make the builder fully responsive ([#65](https://github.com/TightknitAI/block-kitchen/issues/65)) ([5bee7cd](https://github.com/TightknitAI/block-kitchen/commit/5bee7cd39e0ee0c8520185cdf2c6500eb00037e2))
* **palette:** consolidate variants to mirror Slack's Block Kit Builder ([#39](https://github.com/TightknitAI/block-kitchen/issues/39)) ([b3950c5](https://github.com/TightknitAI/block-kitchen/commit/b3950c51acbb85623fbc632fbafc77db25ef9623))
* **palette:** consumer-defined palette via `palette` prop ([#26](https://github.com/TightknitAI/block-kitchen/issues/26)) ([07f09c5](https://github.com/TightknitAI/block-kitchen/commit/07f09c5b94faec8201a6ef88621416708fe960dc))
* **palette:** quick search + collapsible categories ([#35](https://github.com/TightknitAI/block-kitchen/issues/35)) ([62e9d00](https://github.com/TightknitAI/block-kitchen/commit/62e9d00f84f5ab46af7b2b4b50375febed6e43bf))
* prepare 0.7.0 release with peer-dep migration and consumer polish ([#70](https://github.com/TightknitAI/block-kitchen/issues/70)) ([f6c9d7a](https://github.com/TightknitAI/block-kitchen/commit/f6c9d7aca9cdae0e6f8120d636f4d9558c1e35b9))
* rename package to @tightknitai/block-kitchen ([#30](https://github.com/TightknitAI/block-kitchen/issues/30)) ([f34bd51](https://github.com/TightknitAI/block-kitchen/commit/f34bd5145e6a0e5bf50f7b79f3f1885b81e5f3e0))
* **templates:** ship richer default template gallery as library export ([#56](https://github.com/TightknitAI/block-kitchen/issues/56)) ([a0c4886](https://github.com/TightknitAI/block-kitchen/commit/a0c488621900dd1db43bea27f0a3e6e89f7fed0f))
* **theme:** add eclectic preset themes (Slack, Ocean, Sunset, Mono, Cyberpunk) ([#50](https://github.com/TightknitAI/block-kitchen/issues/50)) ([cd611aa](https://github.com/TightknitAI/block-kitchen/commit/cd611aa3d419c9080a7fef9612eeb72a0517d6a9))
* **toolbar:** restyle docs link and make it configurable ([#41](https://github.com/TightknitAI/block-kitchen/issues/41)) ([74cf1d0](https://github.com/TightknitAI/block-kitchen/commit/74cf1d05d025d543bce76d0c6c50240c09c80a63))


### Bug Fixes

* **a11y:** keyboard-accessible block reordering + tighter focus order ([#60](https://github.com/TightknitAI/block-kitchen/issues/60)) ([01aa7e9](https://github.com/TightknitAI/block-kitchen/commit/01aa7e96ba57955219349a44b1d40ddfea22fa7b))
* **a11y:** label upstream image/video toggle so axe button-name passes ([#24](https://github.com/TightknitAI/block-kitchen/issues/24)) ([543436f](https://github.com/TightknitAI/block-kitchen/commit/543436fbb59ac91bfc1a1959c73970084f0d412e))
* **block-row:** align selection chrome with the visible block ([#37](https://github.com/TightknitAI/block-kitchen/issues/37)) ([f0a3a4d](https://github.com/TightknitAI/block-kitchen/commit/f0a3a4de605dd0df9e9b5b02f0d4c048be8d071f))
* **ci:** publish to npm from release-please workflow ([#53](https://github.com/TightknitAI/block-kitchen/issues/53)) ([42ec905](https://github.com/TightknitAI/block-kitchen/commit/42ec9050a2dbb821cfc37990499e8e6032032d76))
* **demo:** apply .dark to &lt;html&gt; so portals follow dark mode ([#42](https://github.com/TightknitAI/block-kitchen/issues/42)) ([c81d1a7](https://github.com/TightknitAI/block-kitchen/commit/c81d1a7723edfbe063bed60a2b601521ddb60dd4))
* **demo:** move templates collapse button to inner edge ([#59](https://github.com/TightknitAI/block-kitchen/issues/59)) ([5c2967b](https://github.com/TightknitAI/block-kitchen/commit/5c2967b7b38742318828fbcd02ff7fca15842308))
* **palette:** align focus + hover styling on the same row element ([#31](https://github.com/TightknitAI/block-kitchen/issues/31)) ([ac9495f](https://github.com/TightknitAI/block-kitchen/commit/ac9495ff4abef96ffdd17b0e72d20b2f66350355))
* **palette:** prevent horizontal scroll on the block menu list ([#27](https://github.com/TightknitAI/block-kitchen/issues/27)) ([ba4a1cb](https://github.com/TightknitAI/block-kitchen/commit/ba4a1cbb22cb80eb2418cd5662071e05df614792))
* **preview:** clip preview frame children to rounded corners ([#43](https://github.com/TightknitAI/block-kitchen/issues/43)) ([4d05156](https://github.com/TightknitAI/block-kitchen/commit/4d0515611960ad7310bfa003da460ffd56949515))
* **preview:** give preview canvas a Slack-style grey for contrast ([#55](https://github.com/TightknitAI/block-kitchen/issues/55)) ([1b9ddfc](https://github.com/TightknitAI/block-kitchen/commit/1b9ddfce30bb12380b6f64235bb5206ea92a04c9))
* **preview:** make every block row span the full preview width ([#49](https://github.com/TightknitAI/block-kitchen/issues/49)) ([f8fd36c](https://github.com/TightknitAI/block-kitchen/commit/f8fd36c46c5684f4fb947e16263b971f0727f1c1))
* **preview:** stop double-translating select chevrons ([#33](https://github.com/TightknitAI/block-kitchen/issues/33)) ([ce2a228](https://github.com/TightknitAI/block-kitchen/commit/ce2a228b578b1f00e9976ae99734e8eced4670b5))
* **preview:** theme the preview canvas via --muted token ([#66](https://github.com/TightknitAI/block-kitchen/issues/66)) ([80d766e](https://github.com/TightknitAI/block-kitchen/commit/80d766e4a7fca101e2374a0d657c2ba646593df2))
* **preview:** tighten markdown block list spacing ([#57](https://github.com/TightknitAI/block-kitchen/issues/57)) ([50774a1](https://github.com/TightknitAI/block-kitchen/commit/50774a128ad862a8eebe4645f3ec919d5ea61715))
* **release:** drop test step from prepublishOnly ([#63](https://github.com/TightknitAI/block-kitchen/issues/63)) ([431ef49](https://github.com/TightknitAI/block-kitchen/commit/431ef49fa6c72a64bd6b06ef7f89da68fb82c08d))
* **security:** sanitize URL schemes in block payloads, preview, and editors ([#46](https://github.com/TightknitAI/block-kitchen/issues/46)) ([43b1dfc](https://github.com/TightknitAI/block-kitchen/commit/43b1dfc2c729092e72fc5cba50528c61e194f33b))
* **ui:** mobile-friendly toolbar, palette sheet, and demo header ([#69](https://github.com/TightknitAI/block-kitchen/issues/69)) ([44b4731](https://github.com/TightknitAI/block-kitchen/commit/44b473115eaf93d13cdc4c81511a0b6a6dc6714f))

## [0.6.3-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.6.2-alpha.0...block-kitchen-v0.6.3-alpha.0) (2026-05-18)


### Features

* **input:** show per-element hint in empty Placeholder field ([#67](https://github.com/TightknitAI/block-kitchen/issues/67)) ([4ee73ad](https://github.com/TightknitAI/block-kitchen/commit/4ee73adcc74875f5fe5a2447e774b04538d92f90))


### Bug Fixes

* **ui:** mobile-friendly toolbar, palette sheet, and demo header ([#69](https://github.com/TightknitAI/block-kitchen/issues/69)) ([44b4731](https://github.com/TightknitAI/block-kitchen/commit/44b473115eaf93d13cdc4c81511a0b6a6dc6714f))

## [0.6.2-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.6.1-alpha.0...block-kitchen-v0.6.2-alpha.0) (2026-05-16)


### Features

* **mobile:** make the builder fully responsive ([#65](https://github.com/TightknitAI/block-kitchen/issues/65)) ([5bee7cd](https://github.com/TightknitAI/block-kitchen/commit/5bee7cd39e0ee0c8520185cdf2c6500eb00037e2))
* **templates:** ship richer default template gallery as library export ([#56](https://github.com/TightknitAI/block-kitchen/issues/56)) ([a0c4886](https://github.com/TightknitAI/block-kitchen/commit/a0c488621900dd1db43bea27f0a3e6e89f7fed0f))


### Bug Fixes

* **a11y:** keyboard-accessible block reordering + tighter focus order ([#60](https://github.com/TightknitAI/block-kitchen/issues/60)) ([01aa7e9](https://github.com/TightknitAI/block-kitchen/commit/01aa7e96ba57955219349a44b1d40ddfea22fa7b))
* **demo:** move templates collapse button to inner edge ([#59](https://github.com/TightknitAI/block-kitchen/issues/59)) ([5c2967b](https://github.com/TightknitAI/block-kitchen/commit/5c2967b7b38742318828fbcd02ff7fca15842308))
* **preview:** theme the preview canvas via --muted token ([#66](https://github.com/TightknitAI/block-kitchen/issues/66)) ([80d766e](https://github.com/TightknitAI/block-kitchen/commit/80d766e4a7fca101e2374a0d657c2ba646593df2))
* **release:** drop test step from prepublishOnly ([#63](https://github.com/TightknitAI/block-kitchen/issues/63)) ([431ef49](https://github.com/TightknitAI/block-kitchen/commit/431ef49fa6c72a64bd6b06ef7f89da68fb82c08d))

## [0.6.1-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.6.0-alpha.0...block-kitchen-v0.6.1-alpha.0) (2026-05-16)


### Features

* **demo:** make templates panel resizable and auto-shrinking ([#54](https://github.com/TightknitAI/block-kitchen/issues/54)) ([8e28fe8](https://github.com/TightknitAI/block-kitchen/commit/8e28fe84717c44a18a055451007e7167bbfaaa59))
* **demo:** prepare for public hosting ([#45](https://github.com/TightknitAI/block-kitchen/issues/45)) ([a77cf11](https://github.com/TightknitAI/block-kitchen/commit/a77cf1167c34f33f6bec701913dd76f79195d361))
* **theme:** add eclectic preset themes (Slack, Ocean, Sunset, Mono, Cyberpunk) ([#50](https://github.com/TightknitAI/block-kitchen/issues/50)) ([cd611aa](https://github.com/TightknitAI/block-kitchen/commit/cd611aa3d419c9080a7fef9612eeb72a0517d6a9))


### Bug Fixes

* **ci:** publish to npm from release-please workflow ([#53](https://github.com/TightknitAI/block-kitchen/issues/53)) ([42ec905](https://github.com/TightknitAI/block-kitchen/commit/42ec9050a2dbb821cfc37990499e8e6032032d76))
* **preview:** give preview canvas a Slack-style grey for contrast ([#55](https://github.com/TightknitAI/block-kitchen/issues/55)) ([1b9ddfc](https://github.com/TightknitAI/block-kitchen/commit/1b9ddfce30bb12380b6f64235bb5206ea92a04c9))
* **preview:** make every block row span the full preview width ([#49](https://github.com/TightknitAI/block-kitchen/issues/49)) ([f8fd36c](https://github.com/TightknitAI/block-kitchen/commit/f8fd36c46c5684f4fb947e16263b971f0727f1c1))
* **preview:** tighten markdown block list spacing ([#57](https://github.com/TightknitAI/block-kitchen/issues/57)) ([50774a1](https://github.com/TightknitAI/block-kitchen/commit/50774a128ad862a8eebe4645f3ec919d5ea61715))
* **security:** sanitize URL schemes in block payloads, preview, and editors ([#46](https://github.com/TightknitAI/block-kitchen/issues/46)) ([43b1dfc](https://github.com/TightknitAI/block-kitchen/commit/43b1dfc2c729092e72fc5cba50528c61e194f33b))

## [0.6.0-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.5.2-alpha.0...block-kitchen-v0.6.0-alpha.0) (2026-05-16)


### ⚠ BREAKING CHANGES

* **palette:** consolidate variants to mirror Slack's Block Kit Builder ([#39](https://github.com/TightknitAI/block-kitchen/issues/39))

### Features

* **palette:** consolidate variants to mirror Slack's Block Kit Builder ([#39](https://github.com/TightknitAI/block-kitchen/issues/39)) ([b3950c5](https://github.com/TightknitAI/block-kitchen/commit/b3950c51acbb85623fbc632fbafc77db25ef9623))
* **toolbar:** restyle docs link and make it configurable ([#41](https://github.com/TightknitAI/block-kitchen/issues/41)) ([74cf1d0](https://github.com/TightknitAI/block-kitchen/commit/74cf1d05d025d543bce76d0c6c50240c09c80a63))


### Bug Fixes

* **demo:** apply .dark to &lt;html&gt; so portals follow dark mode ([#42](https://github.com/TightknitAI/block-kitchen/issues/42)) ([c81d1a7](https://github.com/TightknitAI/block-kitchen/commit/c81d1a7723edfbe063bed60a2b601521ddb60dd4))

## [0.5.2-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.5.1-alpha.0...block-kitchen-v0.5.2-alpha.0) (2026-05-16)


### Features

* add standalone TemplatePicker component ([#34](https://github.com/TightknitAI/block-kitchen/issues/34)) ([ef63a69](https://github.com/TightknitAI/block-kitchen/commit/ef63a697de8073b5c135d0fb54b4edf679dd4a81))

## [0.5.1-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.5.0-alpha.0...block-kitchen-v0.5.1-alpha.0) (2026-05-16)


### Features

* **palette:** quick search + collapsible categories ([#35](https://github.com/TightknitAI/block-kitchen/issues/35)) ([62e9d00](https://github.com/TightknitAI/block-kitchen/commit/62e9d00f84f5ab46af7b2b4b50375febed6e43bf))

## [0.5.0-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.4.0-alpha.0...block-kitchen-v0.5.0-alpha.0) (2026-05-16)


### ⚠ BREAKING CHANGES

* rename package to @tightknitai/block-kitchen ([#30](https://github.com/TightknitAI/block-kitchen/issues/30))
* **palette:** consumer-defined palette via `palette` prop ([#26](https://github.com/TightknitAI/block-kitchen/issues/26))
* allowedBlockTypes + allowedSurfaces allowlists ([#17](https://github.com/TightknitAI/block-kitchen/issues/17))

### Features

* **a11y:** enforce axe in Storybook and fix violations ([#14](https://github.com/TightknitAI/block-kitchen/issues/14)) ([565b656](https://github.com/TightknitAI/block-kitchen/commit/565b656752e2f684a727b88cc8a59fbe0ea6968f))
* add `theme` prop for branding the builder chrome ([#29](https://github.com/TightknitAI/block-kitchen/issues/29)) ([957c7cd](https://github.com/TightknitAI/block-kitchen/commit/957c7cd25dcbe5c40ee6fd6b815069b8eb0a7deb))
* allowedBlockTypes + allowedSurfaces allowlists ([#17](https://github.com/TightknitAI/block-kitchen/issues/17)) ([a5185ad](https://github.com/TightknitAI/block-kitchen/commit/a5185adbf9ee6bc75400352c305f5c3f8d9bf367))
* **dnd:** show clear landing position while dragging a block ([#19](https://github.com/TightknitAI/block-kitchen/issues/19)) ([dd3554b](https://github.com/TightknitAI/block-kitchen/commit/dd3554bb11bc50c96d5048044cfecb64d334430f))
* **palette:** consumer-defined palette via `palette` prop ([#26](https://github.com/TightknitAI/block-kitchen/issues/26)) ([07f09c5](https://github.com/TightknitAI/block-kitchen/commit/07f09c5b94faec8201a6ef88621416708fe960dc))
* rename package to @tightknitai/block-kitchen ([#30](https://github.com/TightknitAI/block-kitchen/issues/30)) ([f34bd51](https://github.com/TightknitAI/block-kitchen/commit/f34bd5145e6a0e5bf50f7b79f3f1885b81e5f3e0))


### Bug Fixes

* **a11y:** label upstream image/video toggle so axe button-name passes ([#24](https://github.com/TightknitAI/block-kitchen/issues/24)) ([543436f](https://github.com/TightknitAI/block-kitchen/commit/543436fbb59ac91bfc1a1959c73970084f0d412e))
* **palette:** align focus + hover styling on the same row element ([#31](https://github.com/TightknitAI/block-kitchen/issues/31)) ([ac9495f](https://github.com/TightknitAI/block-kitchen/commit/ac9495ff4abef96ffdd17b0e72d20b2f66350355))
* **palette:** prevent horizontal scroll on the block menu list ([#27](https://github.com/TightknitAI/block-kitchen/issues/27)) ([ba4a1cb](https://github.com/TightknitAI/block-kitchen/commit/ba4a1cbb22cb80eb2418cd5662071e05df614792))
* **preview:** stop double-translating select chevrons ([#33](https://github.com/TightknitAI/block-kitchen/issues/33)) ([ce2a228](https://github.com/TightknitAI/block-kitchen/commit/ce2a228b578b1f00e9976ae99734e8eced4670b5))

## [0.3.0-alpha.0](https://github.com/TightknitAI/block-kitchen/compare/block-kitchen-v0.2.0-alpha.0...block-kitchen-v0.3.0-alpha.0) (2026-05-16)


### ⚠ BREAKING CHANGES

* allowedBlockTypes + allowedSurfaces allowlists ([#17](https://github.com/TightknitAI/block-kitchen/issues/17))

### Features

* **a11y:** enforce axe in Storybook and fix violations ([#14](https://github.com/TightknitAI/block-kitchen/issues/14)) ([565b656](https://github.com/TightknitAI/block-kitchen/commit/565b656752e2f684a727b88cc8a59fbe0ea6968f))
* allowedBlockTypes + allowedSurfaces allowlists ([#17](https://github.com/TightknitAI/block-kitchen/issues/17)) ([a5185ad](https://github.com/TightknitAI/block-kitchen/commit/a5185adbf9ee6bc75400352c305f5c3f8d9bf367))
* **dnd:** show clear landing position while dragging a block ([#19](https://github.com/TightknitAI/block-kitchen/issues/19)) ([dd3554b](https://github.com/TightknitAI/block-kitchen/commit/dd3554bb11bc50c96d5048044cfecb64d334430f))

## Changelog
