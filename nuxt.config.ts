import { fileURLToPath } from 'node:url'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

// vite-plugin-wasm + vite-plugin-top-level-await load the Rust→WASM APNG
// encoder (wasm/apng-encoder/pkg, --target bundler does `import *.wasm`).
// We use routeRules SPA mode (not global ssr:false), which sidesteps the
// dev-server entry bug these plugins triggered under global ssr:false.

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
    // wasm ESM + top-level-await need a modern build target. esbuild.target
    // covers the transform/minify passes; build.target covers the final chunk
    // target (where the TLA-downlevel error otherwise fires). All 2026 target
    // browsers support TLA + bulk-memory wasm natively.
    build: { target: 'es2022' },
    esbuild: { target: 'es2022' },
    optimizeDeps: { esbuildOptions: { target: 'es2022' } },
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
