import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// `core/` is pure framework-agnostic TS, unit-tested in isolation.
// happy-dom provides a DOM for the few pieces that touch canvas measurement.
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['core/**/*.{test,spec}.ts'],
  },
  resolve: {
    alias: {
      '#core': fileURLToPath(new URL('./core', import.meta.url)),
      '#workers': fileURLToPath(new URL('./workers', import.meta.url)),
      '#types': fileURLToPath(new URL('./types', import.meta.url)),
    },
  },
})
