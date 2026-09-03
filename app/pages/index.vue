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

// Left panel tabs (Content vs Font); right panel is Style/Animation/Export.
const leftTab = ref<'content' | 'font'>('content')
</script>

<template>
  <div class="flex h-screen flex-col bg-app-bg text-app-text">
    <!-- Top bar -->
    <header class="flex items-center justify-between border-b border-app-border px-4 py-2">
      <div class="flex items-center gap-2">
        <span class="text-lg">🎏</span>
        <h1 class="text-sm font-semibold">missemoji</h1>
        <span class="text-xs text-app-muted">APNG emoji generator for Misskey</span>
      </div>
      <ProjectMenu />
    </header>

    <div class="flex min-h-0 flex-1">
      <!-- Left: content / font -->
      <aside class="flex w-72 flex-col border-r border-app-border bg-app-panel">
        <div class="flex border-b border-app-border">
          <button
            type="button"
            class="flex-1 px-3 py-2 text-xs transition-colors"
            :class="leftTab === 'content' ? 'bg-app-panel-2 text-app-text' : 'text-app-muted'"
            @click="leftTab = 'content'"
          >
            Content
          </button>
          <button
            type="button"
            class="flex-1 px-3 py-2 text-xs transition-colors"
            :class="leftTab === 'font' ? 'bg-app-panel-2 text-app-text' : 'text-app-muted'"
            @click="leftTab = 'font'"
          >
            Font
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <TextPanel v-show="leftTab === 'content'" />
          <FontPanel v-show="leftTab === 'font'" />
        </div>
      </aside>

      <!-- Center: preview -->
      <main class="flex min-w-0 flex-1 flex-col">
        <div class="flex items-center justify-center gap-3 border-b border-app-border px-4 py-2">
          <BackgroundToggle />
        </div>
        <div class="min-h-0 flex-1 overflow-auto p-6">
          <PreviewStage />
        </div>
        <div class="space-y-2 border-t border-app-border px-4 py-3">
          <SizePreviewStrip />
          <div class="flex justify-center">
            <PlaybackControls />
          </div>
        </div>
      </main>

      <!-- Right: style / animation / export -->
      <aside class="w-80 overflow-y-auto border-l border-app-border bg-app-panel">
        <StylePanel />
        <AnimationPanel />
        <ExportPanel />
      </aside>
    </div>
  </div>
</template>
