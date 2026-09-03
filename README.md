# missemoji

A browser-based, **APNG-first** custom-emoji generator for **Misskey** — render
like a motion-graphics tool, export like an emoji tool.

- High-resolution RGBA rendering (2×/4×/8× supersampling) downsampled to
  128/256 for clean edges
- **APNG-first** export (full alpha, no GIF banding) + PNG and GIF fallback
  (GIF uses one global palette — no colour shimmer)
- Real **layout solver** (not naive scale-to-fit) with **Japanese-aware** line
  breaking (kinsoku) and a motion reserve measured from the actual animation
- 13 seamlessly looping animation presets: pulse, bounce, pop, wiggle, shake,
  float, wave (per-letter), glow pulse, **spin, blink, gangan, rainbow,
  marquee** — plus direction (forward / reverse / ping-pong), hold-at-rest and
  phase controls
- Curated, keyless Google Fonts (no API key) with JP filtering, italics where
  the family has them, and **custom font upload** (.ttf/.otf/.woff/.woff2)
- Fill (solid / feathered gradient), outline / double outline, shadow, glow,
  solid or rounded background
- Misskey export presets, actual-size preview strip, dark/light/checker
  backgrounds, readability and file-size warnings
- **Preview = export**: one render worker (with its own fonts) renders both the
  live preview frame cache and the exported frames through the same code path
- **Autosave**, undo/redo (⌘Z / ⇧⌘Z), project JSON save/load, **share links**,
  **batch export** (one emoji per line → ZIP)
- Two swappable APNG encoders: **upng-js** (default) and a **Rust→WASM**
  encoder (falls back to upng-js automatically)

## Stack

Nuxt 4 · Vue 3.5 · TypeScript · Pinia · VueUse · Tailwind v4 · Vitest 3 ·
ESLint (@nuxt/eslint) · Prettier

## Develop

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # vitest: core/ unit tests + headless render/export pixel tests
npm run typecheck    # vue-tsc -b across app/, core/, workers/, server/
npm run lint         # eslint (npm run lint:fix to autofix)
npm run format       # prettier --write
npm run build        # production build (node server)
npm run generate     # static SPA (deploy .output/public)
```

Node 22 or 24 is recommended (vitest 4 and ESLint 10 are held back only
because Node 23 is outside their engine ranges).

## Architecture

- `core/` — pure, framework-agnostic TS that runs on the main thread **and** in
  workers: project schema + `migrate.ts` (every load path), fonts, text/layout
  solver, render pipeline (`renderFrameSequence` is the single path for preview
  and export), effects, animation (presets, timing, `computeOvershoot`),
  export encoders, playback helpers.
- `app/` — Nuxt/Vue surface: pages, components, composables, Pinia stores.
  `usePreviewPipeline` keeps an `ImageBitmap` frame cache rendered by the
  worker (stale-while-revalidate, generation-gated); `useExport` reuses the
  preview layout so files match the stage.
- `workers/` — `render.worker.ts` (loads fonts into its own `FontFaceSet`,
  renders frames, yields between frames so cancel works) and
  `encode.worker.ts`; `protocol.ts` is the typed message contract.
  `app/utils/workerRpc.ts` wraps them with crash detection, a stall watchdog and
  lazy respawn; a main-thread renderer is the fallback when the worker cannot
  match the preview's fonts.
- `wasm/apng-encoder/` — Rust→WASM APNG encoder (`pkg/` is committed).

Aliases `#core`, `#workers`, `#types` are set in `nuxt.config.ts` (and mirrored
into the generated tsconfigs). The app renders client-only via `routeRules`.

### Animation model

All lengths in `core/animation/model.ts` are **fractions of the final canvas**
(`translate.x × width`, `translate.y × height`); the renderer multiplies. A
preset returns a `FrameState` (whole-layer transform, paint modulators such as
glow intensity / hue shift, optional per-character function, optional tiling
for marquee). `computeOvershoot` samples the preset with the user's params to
size the layout's safe box so motion never clips. Loop timing
(`direction` / `hold` / `phase`) is applied in `remapProgress` before sampling.

### Share links, autosave and project files

- Autosave: `localStorage['missemoji.project.v2']`, debounced.
- Share link: `#p=d.<base64url(deflate-raw(JSON))>` (`p=j.` = plain JSON when
  compression is unavailable). A link wins over the autosave and is stripped
  from the URL once applied; pasting a link into an open tab also works.
- Project JSON: schema version 2. `migrateProject` upgrades v1 files and
  sanitizes anything hand-edited.

### Rust → WASM APNG encoder

Selectable in the Export panel under **APNG engine**. The committed
`wasm/apng-encoder/pkg/` lets the app run without the Rust toolchain; rebuild
with:

```bash
brew install wasm-pack            # pulls rustup
rustup default stable
rustup target add wasm32-unknown-unknown
npm run wasm:build                # -> wasm/apng-encoder/pkg/
```

`pkg-node/` (a `--target nodejs` build, gitignored) enables the wasm round-trip
test in `core/export/apng/wasmBackend.test.ts`; the test is skipped when absent.

## Fonts (CORS note)

`fonts.googleapis.com/css2` does not send CORS headers, so the browser can't
`fetch()` the stylesheet to extract @font-face URLs for canvas. The app fetches
the CSS through a same-origin Nitro route (`server/api/font-css.get.ts`), parses
the gstatic font URLs (those *are* CORS-enabled), and constructs `FontFace`
objects — on the main thread and again inside the render worker (only the
unicode-range subsets the current text needs). When deployed as a **node
server** this just works. For a **fully static** `nuxt generate` deploy the
loader falls back to a `<link rel="stylesheet">`; the worker cannot use those
faces, so the preview and export then render on the main thread (the stage
shows "main-thread renderer"). Prefer a node-server deploy.

Uploaded fonts are registered with the FontFace API and copied into the
worker; they are kept in memory only and are not saved with the project.

## Notes

- Misskey instance file-size limits vary; the app shows size/readability
  warnings rather than assuming one universal limit.
- Export is download-only; uploading to an instance is left to tools like
  `misskey-emoji-bulk-uploader`.
