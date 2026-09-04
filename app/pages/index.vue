<script setup lang="ts">
import TextPanel from '~/components/panels/TextPanel.vue'
import FontPanel from '~/components/panels/FontPanel.vue'
import StylePanel from '~/components/panels/StylePanel.vue'
import AnimationPanel from '~/components/panels/AnimationPanel.vue'
import ExportPanel from '~/components/panels/ExportPanel.vue'
import PreviewStage from '~/components/preview/PreviewStage.vue'
import BackgroundToggle from '~/components/preview/BackgroundToggle.vue'
import PlaybackControls from '~/components/preview/PlaybackControls.vue'
import SizePreviewStrip from '~/components/preview/SizePreviewStrip.vue'
import ProjectMenu from '~/components/header/ProjectMenu.vue'

// One tab state drives both layouts: on mobile it picks the single visible
// panel; on desktop only text/font matter (left column), the right column
// always shows style + animation + export stacked.
type Tab = 'text' | 'font' | 'style' | 'animate' | 'export'
const tab = ref<Tab>('text')

// What the desktop left column shows, even while a right-column tab is active
// on a narrow window that later widens.
const leftPanel = computed<'text' | 'font'>(() => (tab.value === 'font' ? 'font' : 'text'))

const mobileTabs: { value: Tab; label: string; icon: string }[] = [
  { value: 'text', label: 'Text', icon: '✏️' },
  { value: 'font', label: 'Font', icon: '🔤' },
  { value: 'style', label: 'Style', icon: '🎨' },
  { value: 'animate', label: 'Animate', icon: '🎞️' },
  { value: 'export', label: 'Export', icon: '📦' },
]
</script>

<template>
  <div class="flex h-dvh flex-col bg-app-bg text-app-text">
    <!-- Top bar -->
    <header
      class="flex items-center justify-between gap-2 border-b border-app-border px-3 py-2 sm:px-4"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="text-lg">🎏</span>
        <h1 class="text-sm font-semibold">missemoji</h1>
        <span class="hidden text-xs text-app-muted md:inline"
          >APNG emoji generator for Misskey</span
        >
      </div>
      <ProjectMenu />
    </header>

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <!-- Preview: top of the stack on mobile, centre column on desktop -->
      <main
        class="flex flex-col border-b border-app-border lg:order-2 lg:min-h-0 lg:min-w-0 lg:flex-1 lg:border-b-0"
      >
        <div
          class="hidden items-center justify-center gap-3 border-b border-app-border px-4 py-2 lg:flex"
        >
          <BackgroundToggle />
        </div>
        <div
          class="flex items-start justify-center overflow-auto p-3 lg:min-h-0 lg:flex-1 lg:items-stretch lg:p-6"
        >
          <PreviewStage />
        </div>
        <div class="space-y-2 border-t border-app-border px-3 py-2 lg:px-4 lg:py-3">
          <SizePreviewStrip />
          <div class="flex items-center justify-center gap-3">
            <div class="lg:hidden">
              <BackgroundToggle />
            </div>
            <PlaybackControls class="min-w-0 flex-1 lg:flex-none" />
          </div>
        </div>
      </main>

      <!-- Left column (desktop): content / font -->
      <aside
        class="min-h-0 flex-1 flex-col bg-app-panel lg:order-1 lg:w-72 lg:flex-none lg:border-r lg:border-app-border"
        :class="tab === 'text' || tab === 'font' ? 'flex' : 'hidden lg:flex'"
      >
        <div class="hidden border-b border-app-border lg:flex">
          <button
            type="button"
            class="flex-1 px-3 py-2 text-xs transition-colors"
            :class="leftPanel === 'text' ? 'bg-app-panel-2 text-app-text' : 'text-app-muted'"
            @click="tab = 'text'"
          >
            Content
          </button>
          <button
            type="button"
            class="flex-1 px-3 py-2 text-xs transition-colors"
            :class="leftPanel === 'font' ? 'bg-app-panel-2 text-app-text' : 'text-app-muted'"
            @click="tab = 'font'"
          >
            Font
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <TextPanel
            :class="tab === 'text' ? 'block' : leftPanel === 'text' ? 'hidden lg:block' : 'hidden'"
          />
          <FontPanel
            :class="tab === 'font' ? 'block' : leftPanel === 'font' ? 'hidden lg:block' : 'hidden'"
          />
        </div>
      </aside>

      <!-- Right column (desktop): style / animation / export -->
      <aside
        class="min-h-0 flex-1 overflow-y-auto bg-app-panel lg:order-3 lg:w-80 lg:flex-none lg:border-l lg:border-app-border"
        :class="
          tab === 'style' || tab === 'animate' || tab === 'export' ? 'block' : 'hidden lg:block'
        "
      >
        <StylePanel :class="tab === 'style' ? 'block' : 'hidden lg:block'" />
        <AnimationPanel :class="tab === 'animate' ? 'block' : 'hidden lg:block'" />
        <ExportPanel :class="tab === 'export' ? 'block' : 'hidden lg:block'" />
      </aside>
    </div>

    <!-- Mobile tab bar -->
    <nav
      class="flex border-t border-app-border bg-app-panel pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <button
        v-for="t in mobileTabs"
        :key="t.value"
        type="button"
        class="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition-colors"
        :class="tab === t.value ? 'text-app-accent' : 'text-app-muted'"
        @click="tab = t.value"
      >
        <span class="text-base leading-none">{{ t.icon }}</span>
        {{ t.label }}
      </button>
    </nav>
  </div>
</template>
