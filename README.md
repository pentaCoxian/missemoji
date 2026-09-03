# missemoji

A browser-based, **APNG-first** custom-emoji generator for **Misskey** — render
like a motion-graphics tool, export like an emoji tool.

- High-resolution RGBA rendering downsampled to 128/256 for clean edges
- **APNG-first** export (full alpha, no GIF banding) + PNG and GIF fallback
- Real **layout solver** (not naive scale-to-fit) with **Japanese-aware** line
  breaking (kinsoku)
- Curated, keyless Google Fonts (no API key) with JP filtering
- Fill (solid / frame-spanning feathered gradient), outline / double outline,
  shadow, glow
- 8 smooth, **seamlessly-looping** animation presets
- Misskey export presets, actual-size preview strip, dark/light/checker
  backgrounds, readability warnings
- Full **Web Worker** pipeline (OffscreenCanvas render + encode) — exports never
  freeze the UI
- Two swappable APNG encoders: **upng-js** (default) and a custom **Rust→WASM**
  encoder

## Stack

Nuxt 4 · Vue 3 · TypeScript · Pinia · VueUse · Tailwind v4 (no DaisyUI) · Vitest

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run test       # vitest (core/ unit + headless render/export tests)
npm run typecheck  # vue-tsc across app/, core/, workers/
npm run build      # production build
npm run generate   # static SPA (deploy .output/public)
```

## Architecture

- `core/` — pure, framework-agnostic TS (runs on main thread **and** in workers):
  project schema, fonts, text/layout solver, render pipeline, effects,
  animation, export encoders.
- `app/` — Nuxt/Vue surface: pages, components, composables, Pinia stores.
- `workers/` — render + encode workers (import only `#core`, kept Vue-free).
- `wasm/apng-encoder/` — Rust→WASM APNG encoder.

Aliases `#core`, `#workers`, `#types` are set in both `nuxt.config.ts` and
`tsconfig.json`. The app renders client-only via `routeRules` SPA mode.

## Rust → WASM APNG encoder

The optional WASM encoder (selectable in the Export panel under **APNG engine**)
is built from the Rust `apng` crate. The committed `wasm/apng-encoder/pkg/` lets
the app run without the Rust toolchain; rebuild it with:

```bash
# one-time toolchain (macOS):
brew install wasm-pack            # pulls rustup
rustup default stable
rustup target add wasm32-unknown-unknown

npm run wasm:build                # -> wasm/apng-encoder/pkg/
```

The day-1 default encoder is **upng-js** (pure JS), so the app is fully
functional even if the WASM pkg is absent.

## Fonts (CORS note)

`fonts.googleapis.com/css2` does not send CORS headers, so the browser can't
`fetch()` the stylesheet to extract @font-face URLs for canvas. The app fetches
the CSS through a same-origin Nitro route (`server/api/font-css.get.ts`), parses
the gstatic font URLs (those *are* CORS-enabled), and constructs `FontFace`
objects for canvas. When deployed as a **node server** this just works. For a
**fully static** `nuxt generate` deploy (no server), the loader falls back to
injecting a `<link rel="stylesheet">` — slightly less reliable for canvas but
keeps the app usable. Prefer a node-server deploy for best font fidelity.

## Notes

- Misskey instance file-size limits vary; the app shows size/readability
  warnings rather than assuming one universal limit.
- Export is download-only; uploading to an instance is left to tools like
  `misskey-emoji-bulk-uploader`.
