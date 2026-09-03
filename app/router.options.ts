import type { RouterConfig } from '@nuxt/schema'

/**
 * Single-page tool: never scroll to hash targets. Share links live in the
 * hash (`#p=…`) and are consumed by the persistence plugin, not the router.
 */
export default {
  scrollBehavior() {
    return false
  },
} satisfies RouterConfig
