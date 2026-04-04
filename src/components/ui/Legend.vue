<template>
  <!-- グラデーション条と両端ラベル（チャート・マップの補助） -->
  <div class="space-y-1.5">
    <p v-if="title" class="text-sm font-medium text-muted-foreground">{{ title }}</p>
    <div
      class="h-3 w-full border border-border"
      :style="{ background: gradient }"
    />
    <div class="flex justify-between">
      <span class="text-xs text-muted-foreground">{{ minLabel }}</span>
      <span class="text-xs text-muted-foreground">{{ maxLabel }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  /** 凡例タイトル（省略可） */
  title?: string
  /** グラデーション左端のラベル */
  minLabel: string
  /** グラデーション右端のラベル */
  maxLabel: string
  /** CSS `background` に渡すグラデーション文字列 */
  gradient: string
}>()
</script>
