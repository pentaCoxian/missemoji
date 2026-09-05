import { fileURLToPath } from 'node:url'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// vite-plugin-wasm + vite-plugin-top-level-await load the Rust→WASM APNG
// encoder (wasm/apng-encoder/pkg, --target bundler does `import *.wasm`).
// We use routeRules SPA mode (not global ssr:false), which sidesteps the
// dev-server entry bug these plugins triggered under global ssr:false.

// Link-preview metadata. The absolute URL matters: og:image is fetched by
// crawlers that have no page context, so a relative path silently yields a
// card with no image. NUXT_PUBLIC_SITE_URL overrides it for a preview deploy.
const SITE_URL = (process.env.NUXT_PUBLIC_SITE_URL ?? 'https://missemoji.pages.dev').replace(
  /\/$/,
  '',
)
const SITE_TITLE = 'missemoji — Misskey APNG emoji generator'
const SITE_DESCRIPTION =
  'Make animated APNG custom emoji for Misskey in the browser: Google Fonts, gradients, outlines, glow and a dozen animation presets, exported at the size your instance wants.'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-06-01',
  devtools: { enabled: true },

  // The whole app is a client-only canvas/worker tool — SSR buys nothing and
  // breaks OffscreenCanvas / FontFace / Worker. We render every route as a SPA
  // via routeRules rather than the global `ssr:false` flag, which trips a
  // "No entry found in rollupOptions.input" bug in `nuxt dev` with this
  // Nuxt 4 / Vite 7 combo. routeRules ssr:false gives the same client-only
  // result and a static SPA on `nuxt generate`.
  routeRules: {
    '/**': { ssr: false },
  },

  app: {
    head: {
      title: 'missemoji — Misskey APNG emoji generator',
      htmlAttrs: { lang: 'ja' },
      link: [
        // The PNG favicon is enough for every browser we target; no .ico.
        { rel: 'icon', type: 'image/png', href: '/icon.png' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      meta: [
        { name: 'description', content: SITE_DESCRIPTION },
        { name: 'theme-color', content: '#232323' },
        // Open Graph, for link previews on Misskey, Mastodon, Discord, Slack…
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'missemoji' },
        { property: 'og:title', content: SITE_TITLE },
        { property: 'og:description', content: SITE_DESCRIPTION },
        // Crawlers cannot resolve a relative image, so this must be absolute.
        { property: 'og:image', content: `${SITE_URL}/og.png` },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: SITE_TITLE },
        { property: 'og:url', content: SITE_URL },
        // Twitter/X reads its own names and falls back to og: for the rest.
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: SITE_TITLE },
        { name: 'twitter:description', content: SITE_DESCRIPTION },
        { name: 'twitter:image', content: `${SITE_URL}/og.png` },
      ],
    },
  },

  modules: ['@pinia/nuxt', '@vueuse/nuxt', '@nuxt/eslint'],

  // Lint only; formatting is Prettier's job (see .prettierrc).
  eslint: { config: { stylistic: false } },

  // Type-check the framework-free core/, the workers and the ambient module
  // declarations in types/ as part of the app project (they share its lib set:
  // dom + webworker). vitest.config.ts is a node-side file.
  typescript: {
    tsConfig: {
      include: ['../core/**/*', '../workers/**/*', '../types/**/*'],
    },
    nodeTsConfig: {
      compilerOptions: { types: ['node'] },
      include: ['../vitest.config.ts'],
    },
  },

  css: ['~/assets/css/main.css'],

  postcss: {
    plugins: {
      '@tailwindcss/postcss': {},
      autoprefixer: {},
    },
  },

  // `core/`, `workers/` and the wasm pkg live OUTSIDE app/ so Nuxt never
  // auto-imports them. They are referenced explicitly via these aliases,
  // mirrored in tsconfig.json `paths`.
  alias: {
    '#core': fileURLToPath(new URL('./core', import.meta.url)),
    '#workers': fileURLToPath(new URL('./workers', import.meta.url)),
    '#types': fileURLToPath(new URL('./types', import.meta.url)),
  },

  vite: {
    plugins: [wasm(), topLevelAwait()],
    // CJS deps discovered late (first export spawns the encode path) would
    // otherwise trigger a dev-server re-optimization + full page reload.
    optimizeDeps: {
      include: [
        'grapheme-splitter',
        'upng-js',
        'gifenc',
        'fflate',
        '@vue/devtools-core',
        '@vue/devtools-kit',
      ],
      esbuildOptions: { target: 'es2022' },
    },
    // wasm ESM + top-level-await need a modern build target. esbuild.target
    // covers the transform/minify passes; build.target covers the final chunk
    // target (where the TLA-downlevel error otherwise fires). All 2026 target
    // browsers support TLA + bulk-memory wasm natively.
    build: { target: 'es2022' },
    esbuild: { target: 'es2022' },
    // ES module workers so render/encode workers can `import` #core + wasm glue.
    worker: {
      format: 'es',
      plugins: () => [wasm(), topLevelAwait()],
    },
  },

  // Production build target (drives the esbuild minify pass).
  nitro: {
    esbuild: { options: { target: 'es2022' } },
  },
})
