<template>
  <div>
    <h1 class="text-2xl font-bold text-foreground">{{ title }}</h1>
    <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>

    <div class="mt-6">
      <!-- コンパクト表示: 画像読み込み済み -->
      <div v-if="imageData" class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div class="flex-1 text-sm text-muted-foreground">
          <span class="font-medium text-foreground">{{ store.fileName.value }}</span>
          <span class="ml-2">{{ imageData.width }}×{{ imageData.height }}</span>
        </div>
        <label
          class="cursor-pointer text-xs font-medium text-primary hover:underline"
        >
          画像を変更
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="onChangeFile"
          />
        </label>
        <button
          class="text-xs text-muted-foreground hover:text-destructive"
          @click="store.clear()"
        >
          クリア
        </button>
      </div>

      <!-- フル表示: 画像未読み込み -->
      <DropZone v-else accept="image/*" @file-selected="store.loadImage" />

      <div v-if="loadProgress === 'loading'" class="mt-4 text-sm text-muted-foreground">読み込み中...</div>
    </div>

    <div v-if="imageData" class="mt-6">
      <slot />
    </div>

    <div v-else-if="loadProgress !== 'loading'" class="mt-12 text-center text-muted-foreground">
      <component :is="placeholderIcon" class="mx-auto h-12 w-12 opacity-30" />
      <p class="mt-3 text-sm">画像をアップロードすると分析結果が表示されます</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { DropZone } from '@/components/ui'
import { useImageStore } from '@/composables/useImageStore'

defineProps<{
  title: string
  description?: string
  placeholderIcon?: Component
}>()

const store = useImageStore()
const imageData = computed(() => store.imageData.value)
const loadProgress = computed(() => store.loadProgress.value)

function onChangeFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) store.loadImage(file)
}
</script>
