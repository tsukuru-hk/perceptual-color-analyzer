<template>
  <!-- 複数画像タブ：サムネ・削除・追加（分析ページ上部の帯） -->
  <div class="image-tab-bar">
    <!-- 各画像タブ + 追加 -->
    <div class="flex items-stretch gap-px overflow-x-auto bg-muted px-1.5 pt-1.5">
      <div
        v-for="img in images"
        :key="img.id"
        :class="cn(
          'group relative flex shrink-0 cursor-pointer items-center gap-2.5 px-2 py-2 text-xs transition-colors',
          img.id === selectedId
            ? 'rounded-t-lg bg-card text-foreground shadow-sm'
            : 'rounded-t-lg bg-transparent text-muted-foreground hover:bg-card/50',
        )"
        @click="selectImage(img.id)"
      >
        <img
          :src="img.thumbnailUrl"
          :alt="img.fileName"
          :class="cn(
            'h-10 w-10 rounded object-cover transition-opacity',
            img.id !== selectedId && 'opacity-50',
          )"
        />
        <span class="max-w-[140px] truncate">{{ img.fileName }}</span>
        <button
          :class="cn(
            'ml-4 flex h-5 w-5 items-center justify-center rounded-full transition-colors',
            img.id === selectedId
              ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
              : 'text-muted-foreground/50 opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100',
          )"
          @click.stop="removeImage(img.id)"
        >
          <X class="h-3.5 w-3.5" :stroke-width="2.5" />
        </button>
      </div>

      <!-- 追加ボタン -->
      <label
        v-if="canAddMore"
        :class="cn(
          'flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-t-lg px-4 py-2.5 text-xs transition-colors',
          dragOver
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-card/50 hover:text-foreground',
        )"
        @dragenter.prevent="dragOver = true"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="onDrop"
      >
        <Plus class="h-5 w-5" />
        <span class="text-[10px] leading-tight">画像追加</span>
        <input
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFileChange"
        />
      </label>
    </div>
    <!-- タブ列と下のコンテンツの区切り線 -->
    <div class="h-px bg-border" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { X, Plus } from 'lucide-vue-next'
import { useImageStore } from '@/composables/useImageStore'
import { cn } from '@/lib/utils'

const { images, selectedId, canAddMore, addImage, removeImage, selectImage } = useImageStore()

const dragOver = ref(false)

function onFileChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) addImage(file)
  ;(event.target as HTMLInputElement).value = ''
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) addImage(file)
}
</script>
