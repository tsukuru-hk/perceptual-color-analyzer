<template>
  <div class="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-lg border border-border bg-card/90 p-1 shadow-sm backdrop-blur-sm">
    <!-- 全体表示トグル -->
    <button
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors"
      :class="showBulkCloud
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted'"
      :title="showBulkCloud ? '全体ポイントを非表示' : '全体ポイントを表示'"
      @click="$emit('toggle-bulk')"
    >
      <Eye v-if="showBulkCloud" :size="14" />
      <EyeOff v-else :size="14" />
      <span>全体</span>
    </button>

    <div class="h-5 w-px bg-border" />

    <!-- ブラシモードトグル -->
    <button
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors"
      :class="brushMode
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted'"
      :title="brushMode ? 'ブラシモードを解除' : 'ブラシモードを有効化'"
      @click="$emit('toggle-brush')"
    >
      <Paintbrush :size="14" />
      <span>ブラシ</span>
    </button>

    <!-- クリア -->
    <button
      v-if="brushPointCount > 0"
      class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      title="ブラシポイントをクリア"
      @click="$emit('clear-brush')"
    >
      <Trash2 :size="14" />
      <span>{{ brushPointCount.toLocaleString() }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Eye, EyeOff, Paintbrush, Trash2 } from 'lucide-vue-next'

defineProps<{
  showBulkCloud: boolean
  brushMode: boolean
  brushPointCount: number
}>()

defineEmits<{
  'toggle-bulk': []
  'toggle-brush': []
  'clear-brush': []
}>()
</script>
