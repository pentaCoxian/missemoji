<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '~/stores/project'
import { useFontsStore } from '~/stores/fonts'
import ChoiceButton from '~/components/controls/ChoiceButton.vue'
import FontPreviewRow from '~/components/fonts/FontPreviewRow.vue'
import {
  groupedCatalog,
  FONT_GROUP_LABELS,
  FONT_CATALOG,
  makeDescriptor,
  type FontDescriptor,
  type FontGroup,
} from '#core/fonts/catalog'

const store = useProjectStore()
const fontsStore = useFontsStore()
const { project } = storeToRefs(store)

const query = ref('')
const jpOnly = ref(false)

interface Section {
  key: string
  label: string
  fonts: FontDescriptor[]
  /** rows in this section are registered locally and need no fetch */
  preloaded?: boolean
  /** rows in this section can be removed */
  removable?: boolean
}

const grouped = computed<Section[]>(() => {
  const q = query.value.trim().toLowerCase()
  const matches = (family: string) => !q || family.toLowerCase().includes(q)
  const sections: Section[] = []

  // Fonts uploaded from disk this session.
  const uploaded = fontsStore.customFonts
    .filter((f) => matches(f.family))
    .map((f) => makeDescriptor(f.family, { weights: [f.weight] }))
  if (uploaded.length) {
    sections.push({
      key: 'uploaded',
      label: 'Uploaded',
      fonts: uploaded,
      preloaded: true,
      removable: true,
    })
  }

  // Fonts added by pasting a Google Fonts link.
  const added = fontsStore.addedFonts
    .filter((f) => matches(f.family))
    .map((f) => makeDescriptor(f.family, { weights: f.weights, italic: f.italic }))
  if (added.length) {
    sections.push({ key: 'added', label: 'Added by link', fonts: added, removable: true })
  }

  if (!q) {
    const favs = FONT_CATALOG.filter((f) => fontsStore.favorites.includes(f.family))
    if (favs.length) sections.push({ key: 'fav', label: 'Favorites', fonts: favs })
    const recents = fontsStore.recent
      .map((fam) => FONT_CATALOG.find((f) => f.family === fam))
      .filter((f): f is FontDescriptor => !!f)
    if (recents.length) sections.push({ key: 'recent', label: 'Recently used', fonts: recents })
  }

  for (const { group, fonts } of groupedCatalog()) {
    let list = fonts
    if (jpOnly.value) list = list.filter((f) => f.japanese)
    if (q) list = list.filter((f) => matches(f.family))
    if (list.length) {
      sections.push({ key: group, label: FONT_GROUP_LABELS[group as FontGroup], fonts: list })
    }
  }
  return sections
})

function pick(family: string) {
  store.setFontFamily(family)
}

function remove(section: Section, family: string) {
  if (section.key === 'uploaded') fontsStore.removeCustomFont(family)
  else fontsStore.removeAddedFont(family)
  if (project.value.font.family === family) store.setFontFamily('Mochiy Pop One')
}
</script>

<template>
  <div class="space-y-3">
    <input
      v-model="query"
      type="search"
      placeholder="Search fonts…"
      class="w-full rounded-app border border-app-border bg-app-panel-2 px-3 py-2 text-sm outline-none focus:border-app-accent"
    />
    <label class="flex items-center gap-2 text-xs text-app-muted">
      <input v-model="jpOnly" type="checkbox" class="accent-app-accent" />
      Japanese fonts only
    </label>

    <div class="max-h-[55vh] space-y-4 overflow-y-auto pr-1">
      <div v-for="section in grouped" :key="section.key">
        <div class="mb-1 text-xs font-semibold uppercase tracking-wide text-app-muted">
          {{ section.label }}
        </div>
        <ul class="space-y-1">
          <li v-for="f in section.fonts" :key="section.key + f.family">
            <ChoiceButton
              class="flex w-full items-center gap-2 px-3 py-2 text-left"
              :active="f.family === project.font.family"
              @click="pick(f.family)"
            >
              <span class="min-w-0 flex-1">
                <FontPreviewRow
                  :family="f.family"
                  :sample="project.text"
                  :preloaded="section.preloaded"
                />
                <span class="block truncate text-[10px] text-app-muted">{{ f.family }}</span>
              </span>
              <span class="flex shrink-0 items-center gap-1">
                <span v-if="fontsStore.isLoading(f.family)" class="text-[10px] text-app-muted"
                  >loading…</span
                >
                <span
                  v-else-if="fontsStore.isFailed(f.family)"
                  class="text-[10px] text-app-danger"
                  title="The font could not be downloaded; a fallback font is used"
                  >failed</span
                >
                <button
                  v-if="section.removable"
                  type="button"
                  class="text-xs text-app-border hover:text-app-danger"
                  :aria-label="'remove ' + f.family"
                  @click.stop="remove(section, f.family)"
                >
                  ✕
                </button>
                <button
                  type="button"
                  class="text-xs"
                  :class="
                    fontsStore.favorites.includes(f.family)
                      ? 'text-app-warn'
                      : 'text-app-border hover:text-app-muted'
                  "
                  :aria-label="'favorite ' + f.family"
                  @click.stop="fontsStore.toggleFavorite(f.family)"
                >
                  ★
                </button>
              </span>
            </ChoiceButton>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
